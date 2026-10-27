from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
)

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = (
    BASE_DIR
    / "data"
    / "heart_disease"
    / "processed.cleveland.data"
)

COLUMNS = [
    "age", "sex", "cp", "trestbps", "chol", "fbs",
    "restecg", "thalach", "exang", "oldpeak",
    "slope", "ca", "thal", "target"
]


def load_dataset():
    df = pd.read_csv(
        DATA_FILE,
        header=None,
        names=COLUMNS,
        na_values="?"
    )

    # Convert all columns to numeric; unknown values become missing.
    df = df.apply(pd.to_numeric, errors="coerce")

    # UCI target: 0 = no disease; 1–4 = disease present.
    df["target"] = (df["target"] > 0).astype(int)

    return df


def train_model():
    df = load_dataset()

    X = df.drop(columns=["target"])
    y = df["target"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y
    )

    model = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("classifier", LogisticRegression(max_iter=2000))
    ])

    model.fit(X_train, y_train)
    predictions = model.predict(X_test)

    print("Dataset shape:", df.shape)
    print("\nTest-set results")
    print("Accuracy:", round(accuracy_score(y_test, predictions), 4))
    print("Precision:", round(
        precision_score(y_test, predictions, zero_division=0), 4
    ))
    print("Recall:", round(
        recall_score(y_test, predictions, zero_division=0), 4
    ))
    print("F1-score:", round(
        f1_score(y_test, predictions, zero_division=0), 4
    ))
    print("\nClassification report:")
    print(classification_report(y_test, predictions, zero_division=0))

    return model


if __name__ == "__main__":
    train_model()