"""Stand-in genlayer module for contract tests (never used on-chain)."""
import json


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
    def __init__(self):
        self.pages = {}
        self.fail_urls = set()

    def render(self, url, mode="text"):
        if url in self.fail_urls:
            raise Exception("fetch failed")
        if url not in self.pages:
            raise Exception("unknown url in stub: " + url)
        return self.pages[url]


class _Nondet:
    def __init__(self):
        self.web = _Web()
        self.verdict_queue = []

    def exec_prompt(self, prompt, response_format="json"):
        if not self.verdict_queue:
            raise Exception("no stubbed verdict queued")
        verdict = self.verdict_queue.pop(0)
        return json.dumps(verdict)


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


gl = _GL()
__all__ = ["gl", "TreeMap"]
