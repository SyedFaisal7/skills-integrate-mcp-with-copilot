import importlib.util
import pathlib
import unittest

from fastapi.testclient import TestClient


ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("activity_app", ROOT / "src" / "app.py")
activity_app = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(activity_app)


class ActivityApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(activity_app.app)

    def test_activities_include_location_data(self):
        response = self.client.get("/activities")

        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertIn("Chess Club", data)

        chess_club = data["Chess Club"]
        self.assertIn("location", chess_club)
        self.assertIn("lat", chess_club["location"])
        self.assertIn("lng", chess_club["location"])


if __name__ == "__main__":
    unittest.main()
