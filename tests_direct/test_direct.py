"""Direct tests for contracts/debatetree.py (no nondet mocks, separate process)."""
import importlib.util
import json
import os
import sys
import unittest
from unittest.mock import patch


class UserError(Exception):
    pass


class Return:
    def __init__(self, calldata):
        self.calldata = calldata


class TreeMap(dict):
    def get(self, key, default=""):
        return super().get(key, default)


class _Message:
    def __init__(self):
        self.sender_address = "0x0000000000000000000000000000000000000000"


class _VM:
    UserError = UserError
    Return = Return

    @staticmethod
    def run_nondet_unsafe(leader, validator):
        result = leader()
        if not validator(Return(result)):
            raise Exception("MAJORITY_DISAGREE")
        return result


class _Web:
    def render(self, url, mode="text"):
        return "This domain is for use in illustrative examples in documents."


class _Nondet:
    def __init__(self):
        self.web = _Web()

    def exec_prompt(self, prompt, response_format="json"):
        return json.dumps({"verdict": "SOUND",
                           "quote": "This domain is for use in illustrative examples in documents.",
                           "reason": "reasoned judgment here"})


class _Public:
    @staticmethod
    def write(fn):
        return fn

    @staticmethod
    def view(fn):
        return fn


class _GL:
    def __init__(self):
        self.message = _Message()
        self.vm = _VM()
        self.public = _Public()
        self.nondet = _Nondet()
        self.Contract = object


class _StubModule:
    pass


stub = _StubModule()
stub.gl = _GL()
stub.TreeMap = TreeMap
sys.modules["genlayer"] = stub

spec = importlib.util.spec_from_file_location(
    "debatetree_direct", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "contracts", "debatetree.py"))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
gl = stub.gl

CREATOR = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
ALICE = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"


class TestHelpers(unittest.TestCase):
    def test_text_bounds(self):
        self.assertEqual(mod.text("  hello world  ", 3, 20), "hello world")
        with self.assertRaises(UserError):
            mod.text("hi", 3, 20)
        with self.assertRaises(UserError):
            mod.text("x" * 21, 3, 20)

    def test_url_value(self):
        self.assertEqual(mod.url_value("https://example.com/x"), "https://example.com/x")
        with self.assertRaises(UserError):
            mod.url_value("http://example.com/x")
        with self.assertRaises(UserError):
            mod.url_value("https://example.com/" + "y" * 600)

    def test_weights(self):
        self.assertEqual(mod.WEIGHTS, {"SOUND": 2, "UNVERIFIED": 0, "FLAWED": -1})

    def test_parse_verdict(self):
        page = "This domain is for use in illustrative examples in documents."
        ok = mod.parse_verdict({"verdict": "SOUND", "quote": page, "reason": "reasoned judgment here"}, page)
        self.assertEqual(ok["verdict"], "SOUND")
        with self.assertRaises(UserError):
            mod.parse_verdict({"verdict": "SOUND", "quote": "not on the page at all", "reason": "reasoned judgment here"}, page)
        with self.assertRaises(UserError):
            mod.parse_verdict({"verdict": "MAYBE", "quote": "", "reason": "reasoned judgment here"}, page)
        ok = mod.parse_verdict({"verdict": "UNVERIFIED", "quote": "", "reason": "reasoned judgment here"}, page)
        self.assertEqual(ok["verdict"], "UNVERIFIED")


class TestDirectFlow(unittest.TestCase):
    def test_create_post_assess_close(self):
        c = mod.DebateTree()
        c.__init__()
        gl.message.sender_address = CREATOR
        d = json.loads(c.create_debate("Example domains in docs", "Should example domains be used in documentation?"))
        gl.message.sender_address = ALICE
        a = json.loads(c.post_argument(d["id"], "FOR", "Example Domain is reserved for illustrative examples.", "https://example.com/", ""))
        assessed = json.loads(c.assess_argument(a["id"]))
        self.assertEqual((assessed["verdict"], assessed["weight"]), ("SOUND", 2))
        b = json.loads(c.post_argument(d["id"], "AGAINST", "Example Domain is used in illustrative examples.", "https://example.com/", ""))
        json.loads(c.assess_argument(b["id"]))
        gl.message.sender_address = CREATOR
        closed = json.loads(c.close_debate(d["id"]))
        self.assertEqual((closed["status"], closed["winner"]), ("CLOSED", "TIE"))
        counts = json.loads(c.get_counts())
        self.assertEqual(counts, {"argument_count": 2, "assessed_count": 2, "closed_count": 1, "debate_count": 1})

class TestAppeals(unittest.TestCase):
    def setUp(self):
        self.contract = mod.DebateTree()
        gl.message.sender_address = CREATOR
        self.debate = json.loads(self.contract.create_debate("Opening hours", "Which schedule controls the library hours?"))
        gl.message.sender_address = ALICE
        argument = json.loads(self.contract.post_argument(self.debate["id"], "FOR", "The library opens at ten on Saturdays.", "https://example.com/old", ""))
        self.id = argument["id"]
        argument.update(status="ASSESSED", verdict="FLAWED", weight=-1, quote="Old schedule contradicts the claim.", reason="The old publication lists nine.")
        self.contract._save_argument(argument)
        current = self.state()
        current.update(for_total=-1, assessed_count=2)
        self.contract._save_debate(current)

    def state(self):
        return json.loads(self.contract.get_debate(self.debate["id"]))

    def file(self):
        return self.contract.file_appeal(self.id, "https://example.com/correction", "The corrected schedule supersedes the original.")

    def test_reversal_preserves_original_applies_delta_once_and_unlocks_close(self):
        self.file()
        gl.message.sender_address = CREATOR
        with self.assertRaisesRegex(UserError, "APPEALS_PENDING"):
            self.contract.close_debate(self.debate["id"])
        result = json.loads(self.contract.resolve_appeal(self.id))
        self.assertEqual(result["original"]["verdict"], "FLAWED")
        self.assertEqual((result["appeal"]["status"], result["appeal"]["delta"]), ("REVERSED", 3))
        self.assertEqual(self.state()["for_total"], 2)
        self.assertEqual(self.state()["assessed_count"], 2)
        with self.assertRaisesRegex(UserError, "NO_PENDING_APPEAL"):
            self.contract.resolve_appeal(self.id)
        self.assertEqual(json.loads(self.contract.close_debate(self.debate["id"]))["winner"], "FOR")

    def test_appeal_authorization_and_withdrawal(self):
        gl.message.sender_address = CREATOR
        with self.assertRaisesRegex(UserError, "UNAUTHORIZED"):
            self.file()
        gl.message.sender_address = ALICE
        self.file()
        self.assertEqual(json.loads(self.contract.end_appeal(self.id))["appeal"]["status"], "WITHDRAWN")
        self.assertEqual(self.state()["pending_appeals"], 0)
        self.assertEqual(self.state()["for_total"], -1)
        with self.assertRaisesRegex(UserError, "APPEAL_ALREADY_FILED"):
            self.file()

    def test_expiry_is_permissionless_and_exact_at_deadline(self):
        with patch.object(mod.time, "time", return_value=1000):
            record = json.loads(self.file())
        gl.message.sender_address = CREATOR
        with patch.object(mod.time, "time", return_value=record["appeal"]["expires_at"]):
            with self.assertRaisesRegex(UserError, "APPEAL_DEADLINE_PASSED"):
                self.contract.resolve_appeal(self.id)
            self.assertEqual(json.loads(self.contract.end_appeal(self.id))["appeal"]["status"], "EXPIRED")
        self.assertEqual(self.state()["for_total"], -1)

    def test_unsupported_counterevidence_upholds_score(self):
        self.file()
        verdict = {"verdict":"UNVERIFIED", "quote":"", "reason":"Counterevidence does not support the claim."}
        with patch.object(gl.nondet, "exec_prompt", return_value=json.dumps(verdict)):
            result = json.loads(self.contract.resolve_appeal(self.id))
        self.assertEqual((result["verdict"], result["appeal"]["status"], result["appeal"]["delta"]), ("FLAWED", "UPHELD", 0))
        self.assertEqual(self.state()["for_total"], -1)

    def test_validator_disagreement_does_not_apply_change(self):
        self.file()
        valid_quote = "This domain is for use in illustrative examples in documents."
        answers = [
            json.dumps({"verdict":"SOUND", "quote":valid_quote, "reason":"This genuinely is an exact quote."}),
            json.dumps({"verdict":"UNVERIFIED", "quote":"", "reason":"The second judgment does not agree."}),
        ]
        with patch.object(gl.nondet, "exec_prompt", side_effect=answers):
            with self.assertRaisesRegex(Exception, "MAJORITY_DISAGREE"):
                self.contract.resolve_appeal(self.id)
        self.assertEqual(self.state()["pending_appeals"], 1)
        self.assertEqual(self.state()["for_total"], -1)


if __name__ == "__main__":
    unittest.main()
