import copy
import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('collector', Path(__file__).with_name('collect-video-durations.py'))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)

class CollectorTests(unittest.TestCase):
    def test_iso(self):
        for text, value in [('PT1H23M45S',5025), ('PT25M35S',1535), ('PT59S',59), ('P1DT2H',93600)]:
            self.assertEqual(c.seconds(text),value)
        for text in ['PT', 'P', 'PT0S', 'PT1.2S', 'P1M', '-PT1S', 'garbage']:
            with self.assertRaises(ValueError): c.seconds(text)

    def test_id_match_and_no_partial_mutation(self):
        entries={'a':{'durationSeconds':60}, 'b':{'durationSeconds':70}}
        before=copy.deepcopy(entries)
        for items in [[{'id':'other'}],[{'id':'a'},{'id':'a'}]]:
            with self.assertRaises(ValueError):c.apply_response(['a','b'], {'items':items}, entries, c.now())
            self.assertEqual(entries,before)

    def test_conflict_and_unavailable_preserve(self):
        entries={'a':{'durationSeconds':60},'b':{'durationSeconds':70}}
        c.apply_response(['a','b'],{'items':[{'id':'a','contentDetails':{'duration':'PT61S'}}]},entries,c.now())
        self.assertEqual(entries['a']['status'],'conflict')
        self.assertEqual(entries['a']['durationSeconds'],60)
        self.assertEqual(entries['b']['durationSeconds'],70)
        self.assertEqual(entries['b']['lastAttemptStatus'],'unavailable_unspecified')

    def test_verified_and_live(self):
        entries={'a':{'durationSeconds':60},'b':{'durationSeconds':None}}
        c.apply_response(['a','b'],{'items':[{'id':'a','contentDetails':{'duration':'PT1M'}}, {'id':'b','snippet':{'liveBroadcastContent':'live'},'contentDetails':{'duration':'PT2M'}}]},entries,c.now())
        self.assertTrue(c.fresh(entries['a']))
        self.assertEqual(entries['b']['lastAttemptStatus'],'live_not_final')
        self.assertIsNone(entries['b']['durationSeconds'])

    def test_positive(self):
        for value in [True,0,-1,1.5,None]:self.assertFalse(c.positive(value))
        self.assertTrue(c.positive(1))

if __name__=='__main__':unittest.main()
