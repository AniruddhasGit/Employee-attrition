from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_CSV = ROOT / "data" / "raw" / "ibm_hr_attrition.csv"
DEMO_CSV = ROOT / "data" / "raw" / "demo_sample.csv"
MODELS_DIR = ROOT / "models"
