"""Stand-in tests for contracts/debatetree.py (mocked host, separate process)."""
import importlib.util
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stub_genlayer

sys.modules["genlayer"] = stub_genlayer
spec = importlib.util.spec_from_file_location(
    "debatetree", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "contracts", "debatetree.py"))
contract_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(contract_mod)

gl = stub_genlayer.gl
UserError = stub_genlayer.UserError

CREATOR = "0x1111111111111111111111111111111111111111"
ALICE = "0x2222222222222222222222222222222222222222"
BOB = "0x3333333333333333333333333333333333333333"
CAROL = "0x4444444444444444444444444444444444444444"
EVIDENCE = "https://example.com/evidence"
PAGE = "This domain is for use in illustrative examples in documents."


def fresh():
    c = contract_mod.DebateTree()
    c.__init__()
    return c


def set_sender(addr):
    gl.message.sender_address = addr


def make_debate(c, creator=CREATOR, topic="Example domains in docs"):
    set_sender(creator)
    return json.loads(c.create_debate(topic, "Should example domains be used in documentation?"))


def post(c, debate_id, side, claim, sender=ALICE, url=EVIDENCE):
    set_sender(sender)
    return json.loads(c.post_argument(debate_id, side, claim, url, "note"))


def assess(c, argument_id, verdict, quote=PAGE):
    gl.nondet.web.pages[EVIDENCE] = PAGE
    gl.nondet.verdict_queue = [
        {"verdict": verdict, "quote": quote, "reason": "reasoned judgment here"},
        {"verdict": verdict, "quote": quote, "reason": "reasoned judgment here"},
    ]
    return json.loads(c.assess_argument(argument_id))


class TestCreate(unittest.TestCase):
    def test_create_open_and_counts(self):
        c = fresh()
        d = make_debate(c)
        self.assertEqual(d["status"], "OPEN")
        self.assertEqual(d["creator"], CREATOR.lower())
        self.assertEqual(d["for_total"], 0)
        self.assertEqual(d["against_total"], 0)
        counts = json.loads(c.get_counts())
        self.assertEqual(counts["debate_count"], 1)

    def test_create_bounds(self):
        c = fresh()
        set_sender(CREATOR)
        with self.assertRaises(UserError):
            c.create_debate("ab", "Should example domains be used in documentation?")
        with self.assertRaises(UserError):
            c.create_debate("Valid topic", "short")

    def test_per_creator_cap(self):
        c = fresh()
        for _ in range(8):
            make_debate(c)
        with self.assertRaises(UserError):
            make_debate(c)


class TestPost(unittest.TestCase):
    def test_post_both_sides(self):
        c = fresh()
        d = make_debate(c)
        a = post(c, d["id"], "FOR", "Example Domain is reserved for illustrative examples.")
        b = post(c, d["id"], "AGAINST", "Example Domain requires permission before use.", sender=BOB)
        self.assertEqual(a["status"], "PENDING")
        self.assertEqual(b["side"], "AGAINST")
        debate = json.loads(c.get_debate(d["id"]))
        self.assertEqual(debate["argument_count"], 2)
        self.assertEqual(debate["argument_ids"], ["arg-0", "arg-1"])

    def test_post_guards(self):
        c = fresh()
        d = make_debate(c)
        with self.assertRaises(UserError):
            post(c, "debate-99", "FOR", "Example Domain is reserved for illustrative examples.")
        with self.assertRaises(UserError):
            post(c, d["id"], "NEUTRAL", "Example Domain is reserved for illustrative examples.")
        with self.assertRaises(UserError):
            post(c, d["id"], "FOR", "Example Domain is reserved for illustrative examples.", url="http://example.com/x")

    def test_argument_cap(self):
        c = fresh()
        d = make_debate(c)
        for i in range(32):
            post(c, d["id"], "FOR", f"Claim number {i} about Example Domain here.", sender=ALICE)
        with self.assertRaises(UserError):
            post(c, d["id"], "FOR", "One claim too many about Example Domain here.", sender=ALICE)


class TestAssess(unittest.TestCase):
    def test_weights_sound_unverified_flawed(self):
        c = fresh()
        d = make_debate(c)
        a = post(c, d["id"], "FOR", "Example Domain is reserved for illustrative examples.")
        b = post(c, d["id"], "FOR", "Example Domain proves quantum supremacy works today.")
        e = post(c, d["id"], "AGAINST", "Example Domain requires permission before use.", sender=BOB)
        r = assess(c, a["id"], "SOUND")
        self.assertEqual((r["verdict"], r["weight"]), ("SOUND", 2))
        r = assess(c, b["id"], "UNVERIFIED", quote="")
        self.assertEqual((r["verdict"], r["weight"]), ("UNVERIFIED", 0))
        r = assess(c, e["id"], "FLAWED")
        self.assertEqual((r["verdict"], r["weight"]), ("FLAWED", -1))
        debate = json.loads(c.get_debate(d["id"]))
        self.assertEqual((debate["for_total"], debate["against_total"]), (2, -1))
        self.assertEqual(debate["assessed_count"], 3)

    def test_reassess_rejected(self):
        c = fresh()
        d = make_debate(c)
        a = post(c, d["id"], "FOR", "Example Domain is reserved for illustrative examples.")
        assess(c, a["id"], "SOUND")
        gl.nondet.verdict_queue = [
            {"verdict": "SOUND", "quote": PAGE, "reason": "reasoned judgment here"},
            {"verdict": "SOUND", "quote": PAGE, "reason": "reasoned judgment here"},
        ]
        with self.assertRaises(UserError):
            c.assess_argument(a["id"])

    def test_unreachable_fails_closed(self):
        c = fresh()
        d = make_debate(c)
        a = post(c, d["id"], "FOR", "Example Domain is reserved for illustrative examples.", url="https://example.com/missing")
        gl.nondet.web.fail_urls.add("https://example.com/missing")
        with self.assertRaises(UserError):
            c.assess_argument(a["id"])
        arg = json.loads(c.get_argument(a["id"]))
        self.assertEqual(arg["status"], "PENDING")
        gl.nondet.web.fail_urls.discard("https://example.com/missing")

    def test_unreachable_verdict_fails_closed(self):
        c = fresh()
        d = make_debate(c)
        a = post(c, d["id"], "FOR", "Example Domain is reserved for illustrative examples.")
        gl.nondet.web.pages[EVIDENCE] = PAGE
        gl.nondet.verdict_queue = [{"verdict": "UNREACHABLE", "quote": "", "reason": "no page received here"}]
        with self.assertRaises(UserError):
            c.assess_argument(a["id"])
        arg = json.loads(c.get_argument(a["id"]))
        self.assertEqual(arg["status"], "PENDING")

    def test_disagreement_fails(self):
        c = fresh()
        d = make_debate(c)
        a = post(c, d["id"], "FOR", "Example Domain is reserved for illustrative examples.")
        gl.nondet.web.pages[EVIDENCE] = PAGE
        gl.nondet.verdict_queue = [
            {"verdict": "SOUND", "quote": PAGE, "reason": "reasoned judgment here"},
            {"verdict": "FLAWED", "quote": PAGE, "reason": "reasoned judgment here"},
        ]
        with self.assertRaises(Exception):
            c.assess_argument(a["id"])
        arg = json.loads(c.get_argument(a["id"]))
        self.assertEqual(arg["status"], "PENDING")


class TestClose(unittest.TestCase):
    def setup_votes(self, c):
        d = make_debate(c)
        a = post(c, d["id"], "FOR", "Example Domain is reserved for illustrative examples.")
        b = post(c, d["id"], "AGAINST", "Example Domain is used in illustrative examples.", sender=BOB)
        return d, a, b

    def test_close_needs_two_assessed(self):
        c = fresh()
        d, a, _ = self.setup_votes(c)
        assess(c, a["id"], "SOUND")
        set_sender(CREATOR)
        with self.assertRaises(UserError):
            c.close_debate(d["id"])

    def test_close_winner_for(self):
        c = fresh()
        d, a, b = self.setup_votes(c)
        assess(c, a["id"], "SOUND")
        assess(c, b["id"], "FLAWED")
        set_sender(CREATOR)
        closed = json.loads(c.close_debate(d["id"]))
        self.assertEqual((closed["status"], closed["winner"]), ("CLOSED", "FOR"))
        self.assertEqual((closed["for_total"], closed["against_total"]), (2, -1))

    def test_close_tie(self):
        c = fresh()
        d, a, b = self.setup_votes(c)
        assess(c, a["id"], "SOUND")
        assess(c, b["id"], "SOUND")
        set_sender(CREATOR)
        closed = json.loads(c.close_debate(d["id"]))
        self.assertEqual(closed["winner"], "TIE")

    def test_close_guards(self):
        c = fresh()
        d, a, b = self.setup_votes(c)
        assess(c, a["id"], "SOUND")
        assess(c, b["id"], "SOUND")
        set_sender(ALICE)
        with self.assertRaises(UserError):
            c.close_debate(d["id"])
        set_sender(CREATOR)
        json.loads(c.close_debate(d["id"]))
        with self.assertRaises(UserError):
            c.close_debate(d["id"])
        with self.assertRaises(UserError):
            post(c, d["id"], "FOR", "Late claim about Example Domain here.")
        pending = None
        c2 = fresh()
        d2 = make_debate(c2)
        first = post(c2, d2["id"], "FOR", "Example Domain is reserved for illustrative examples.")
        assess(c2, first["id"], "SOUND")
        other = post(c2, d2["id"], "AGAINST", "Example Domain requires permission before use.", sender=BOB)
        assess(c2, other["id"], "SOUND")
        pending = post(c2, d2["id"], "FOR", "Example Domain is used in illustrative examples.", sender=CAROL)
        set_sender(CREATOR)
        json.loads(c2.close_debate(d2["id"]))
        gl.nondet.web.pages[EVIDENCE] = PAGE
        gl.nondet.verdict_queue = [
            {"verdict": "SOUND", "quote": PAGE, "reason": "reasoned judgment here"},
            {"verdict": "SOUND", "quote": PAGE, "reason": "reasoned judgment here"},
        ]
        with self.assertRaises(UserError):
            c2.assess_argument(pending["id"])

    def test_views(self):
        c = fresh()
        d = make_debate(c)
        self.assertEqual(json.loads(c.get_debate(d["id"]))["id"], d["id"])
        self.assertEqual(c.get_debate("debate-99"), "")
        self.assertEqual(c.get_protocol(), "debatetree-1")


if __name__ == "__main__":
    unittest.main()
