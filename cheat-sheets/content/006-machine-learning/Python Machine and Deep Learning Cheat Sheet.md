# Python Machine & Deep Learning Cheat Sheet

## Section 1: Setup & Workflow

### Standard Imports and Reproducibility

```python
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, classification_report

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader

# Reproducibility: seed everything you can
SEED = 42
np.random.seed(SEED)
torch.manual_seed(SEED)
torch.cuda.manual_seed_all(SEED)

# Pick a device once, move model AND data to it
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
```

### The ML Project Loop

| Step | What to do | Typical tool |
|---|---|---|
| 1. Frame the problem | Classification, regression, clustering, ranking? Pick the metric first | -- |
| 2. Split data | Hold out a **test set** and never touch it until the end | `train_test_split` |
| 3. Explore | Distributions, missing values, leakage, class balance | `pandas`, `matplotlib` |
| 4. Preprocess | Impute, scale, encode, **fit on train only** | `Pipeline`, `ColumnTransformer` |
| 5. Baseline | A dummy model or simple linear model sets the bar | `DummyClassifier`, `LogisticRegression` |
| 6. Iterate | Better features, stronger models, tuning | CV + `GridSearchCV` / Optuna |
| 7. Final check | Evaluate **once** on the test set | metrics, plots |
| 8. Ship | Save the whole pipeline, not just the model | `joblib.dump` |

> **Golden rule:** anything that learns from data (scalers, imputers, encoders, feature selectors) must be fit on the training split only. Fitting on all the data is **data leakage** and inflates scores.

## Section 2: NumPy & Data Essentials for ML

### Arrays, Shapes, and Broadcasting

```python
X = np.random.randn(100, 5)        # 100 samples, 5 features
X.shape, X.ndim, X.dtype           # (100, 5), 2, float64

X.reshape(-1, 1)                   # -1 infers that dimension
X[:, 0]                            # first column (1-D)
X[:, [0, 2]]                       # columns 0 and 2
X[X[:, 0] > 0]                     # boolean mask on rows

X.mean(axis=0)                     # per-feature mean (collapses rows)
X.std(axis=1)                      # per-sample std (collapses columns)
(X - X.mean(axis=0)) / X.std(axis=0)   # broadcasting: manual standardization

np.argmax(probs, axis=1)           # class index with highest score
np.concatenate([a, b], axis=0)     # stack along rows
np.stack([a, b], axis=0)           # new axis
X @ W + b                          # matrix multiply (same as np.matmul)
```

### Shape Conventions

| Object | Shape | Notes |
|---|---|---|
| Tabular features `X` | `(n_samples, n_features)` | scikit-learn convention |
| Target `y` | `(n_samples,)` | 1-D, not `(n, 1)` |
| Image batch (PyTorch) | `(N, C, H, W)` | channels first |
| Image batch (TensorFlow/Keras) | `(N, H, W, C)` | channels last |
| Sequence batch (PyTorch default) | `(seq_len, N, features)` | use `batch_first=True` for `(N, seq_len, features)` |
| Token batch | `(N, seq_len)` | integer ids |

## Section 3: Preprocessing & Feature Engineering

### Splitting Data

```python
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=SEED,
    stratify=y,            # keep class proportions (classification)
)

# Time series: never shuffle, split by time
split = int(len(df) * 0.8)
train, test = df.iloc[:split], df.iloc[split:]
```

### Scaling, Encoding, and Imputation

| Tool | Use | Notes |
|---|---|---|
| `StandardScaler` | zero mean, unit variance | default for linear models, SVM, KNN, NNs |
| `MinMaxScaler` | scales to `[0, 1]` | sensitive to outliers |
| `RobustScaler` | uses median and IQR | good with outliers |
| `OneHotEncoder` | nominal categories | `handle_unknown="ignore"` for safety |
| `OrdinalEncoder` | ordered categories | encodes order, not distance |
| `SimpleImputer` | mean / median / most_frequent | add `add_indicator=True` to keep missingness signal |
| `PolynomialFeatures` | interaction and power terms | grows fast with degree |
| `PowerTransformer` | make skewed data more Gaussian | Yeo-Johnson / Box-Cox |

Tree-based models (random forest, gradient boosting) do **not** need scaling.

### Pipeline + ColumnTransformer (the Right Way)

```python
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression

num_cols = ["age", "income"]
cat_cols = ["city", "plan"]

preprocess = ColumnTransformer([
    ("num", Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
    ]), num_cols),
    ("cat", Pipeline([
        ("impute", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore")),
    ]), cat_cols),
])

clf = Pipeline([
    ("prep", preprocess),
    ("model", LogisticRegression(max_iter=1000)),
])

clf.fit(X_train, y_train)          # all steps fit on train only
clf.predict(X_test)                # same transforms applied to test
```

Because the preprocessing lives inside the pipeline, cross-validation re-fits it for every fold, so no leakage.

### Handling Class Imbalance

```python
# 1. Re-weight the loss (simplest, works for most models)
LogisticRegression(class_weight="balanced")

# 2. Resample (imbalanced-learn); apply ONLY to the training fold
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
pipe = ImbPipeline([("smote", SMOTE()), ("model", clf)])

# 3. Move the decision threshold instead of retraining
preds = (model.predict_proba(X_test)[:, 1] >= 0.3).astype(int)
```

Use **PR-AUC, recall, precision, F1**, not accuracy, when classes are imbalanced.

## Section 4: Classical ML Models (scikit-learn)

### The Estimator API

Every estimator follows the same pattern, which is why models are interchangeable.

```python
model = SomeModel(hyperparameter=value)   # configure
model.fit(X_train, y_train)               # learn
y_pred = model.predict(X_test)            # predict labels / values
proba = model.predict_proba(X_test)       # class probabilities (classifiers)
score = model.score(X_test, y_test)       # accuracy (clf) or R^2 (reg)
X_new = transformer.transform(X)          # transformers: fit / transform / fit_transform
```

### Choosing a Model

| Model | Task | Strengths | Watch out for |
|---|---|---|---|
| `LinearRegression` / `Ridge` / `Lasso` | Regression | Fast, interpretable | Linear assumption; scale features for regularization |
| `LogisticRegression` | Classification | Strong baseline, calibrated probabilities | Linear boundary |
| `KNeighbors*` | Both | No training, simple | Slow at predict time; needs scaling |
| `SVC` / `SVR` | Both | Great on small/medium data, kernels | Scales poorly past ~100k rows; needs scaling |
| `DecisionTree*` | Both | Interpretable, no scaling | Overfits easily |
| `RandomForest*` | Both | Robust, little tuning | Large models, slower inference |
| `GradientBoosting*` / XGBoost / LightGBM | Both | Best on tabular data | More hyperparameters; can overfit |
| `GaussianNB` / `MultinomialNB` | Classification | Very fast, good for text | Independence assumption |
| `MLPClassifier` | Both | Flexible | Prefer PyTorch for anything serious |

### Common Models in Code

```python
from sklearn.linear_model import Ridge, Lasso, ElasticNet, LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier

Ridge(alpha=1.0)                          # L2 penalty
Lasso(alpha=0.1)                          # L1 penalty (sparse weights)
ElasticNet(alpha=0.1, l1_ratio=0.5)       # mix of L1 and L2
LogisticRegression(C=1.0, penalty="l2")   # C is INVERSE regularization strength
SVC(kernel="rbf", C=1.0, gamma="scale", probability=True)
KNeighborsClassifier(n_neighbors=5)
DecisionTreeClassifier(max_depth=5, min_samples_leaf=10)
RandomForestClassifier(n_estimators=300, max_depth=None, n_jobs=-1, random_state=SEED)
GradientBoostingClassifier(n_estimators=200, learning_rate=0.05, max_depth=3)
```

### Gradient Boosting Libraries

```python
import xgboost as xgb
import lightgbm as lgb

model = xgb.XGBClassifier(
    n_estimators=2000,
    learning_rate=0.03,
    max_depth=6,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_lambda=1.0,
    early_stopping_rounds=50,    # stop when the validation score stalls
    eval_metric="logloss",
)
model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)

lgbm = lgb.LGBMClassifier(n_estimators=2000, learning_rate=0.03, num_leaves=31)
lgbm.fit(X_train, y_train, eval_set=[(X_val, y_val)],
         callbacks=[lgb.early_stopping(50)])
```

| Hyperparameter | Effect | Typical direction |
|---|---|---|
| `learning_rate` | Step size per tree | Lower + more trees = better, slower |
| `n_estimators` | Number of trees | Use early stopping instead of guessing |
| `max_depth` / `num_leaves` | Tree complexity | Lower to reduce overfitting |
| `subsample`, `colsample_bytree` | Row / column sampling | 0.6 to 0.9 adds regularization |
| `min_child_weight` / `min_child_samples` | Minimum leaf size | Raise to reduce overfitting |
| `reg_lambda`, `reg_alpha` | L2 / L1 penalty | Raise to reduce overfitting |

## Section 5: Model Evaluation

### Metrics Cheat Table

| Task | Metric | Function | Use when |
|---|---|---|---|
| Classification | Accuracy | `accuracy_score` | Balanced classes only |
| Classification | Precision | `precision_score` | False positives are costly |
| Classification | Recall | `recall_score` | False negatives are costly |
| Classification | F1 | `f1_score` | Balance of precision and recall |
| Classification | ROC-AUC | `roc_auc_score` | Ranking quality, balanced-ish data |
| Classification | PR-AUC | `average_precision_score` | Imbalanced data |
| Classification | Log loss | `log_loss` | Probability quality |
| Regression | MAE | `mean_absolute_error` | Robust to outliers, same units as target |
| Regression | MSE / RMSE | `mean_squared_error` | Penalizes big errors |
| Regression | R^2 | `r2_score` | Share of variance explained |
| Clustering | Silhouette | `silhouette_score` | No ground-truth labels |

### Confusion Matrix Quick Reference

|  | Predicted positive | Predicted negative |
|---|---|---|
| **Actual positive** | TP | FN |
| **Actual negative** | FP | TN |

* **Precision** = TP / (TP + FP) : of what I flagged, how much was right?
* **Recall (sensitivity)** = TP / (TP + FN) : of the real positives, how many did I find?
* **Specificity** = TN / (TN + FP)
* **F1** = 2 * P * R / (P + R)

```python
from sklearn.metrics import (confusion_matrix, ConfusionMatrixDisplay,
                             classification_report, roc_auc_score, RocCurveDisplay,
                             root_mean_squared_error, r2_score)

print(classification_report(y_test, y_pred))
ConfusionMatrixDisplay.from_predictions(y_test, y_pred)
RocCurveDisplay.from_estimator(model, X_test, y_test)

roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])
root_mean_squared_error(y_test, y_pred)
r2_score(y_test, y_pred)
```

### Cross-Validation

```python
from sklearn.model_selection import (cross_val_score, cross_validate,
                                     StratifiedKFold, KFold, TimeSeriesSplit, GroupKFold)

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
scores = cross_val_score(clf, X, y, cv=cv, scoring="f1")
print(f"{scores.mean():.3f} +/- {scores.std():.3f}")

cross_validate(clf, X, y, cv=cv, scoring=["accuracy", "f1"], return_train_score=True)
```

| Splitter | Use when |
|---|---|
| `KFold` | Regression, i.i.d. data |
| `StratifiedKFold` | Classification (keeps class ratios) |
| `GroupKFold` | Several rows per patient / user / device; keep a group in one fold |
| `TimeSeriesSplit` | Temporal data; train always precedes validation |

### Bias, Variance, and Diagnosing Fit

| Symptom | Train score | Validation score | Diagnosis | Fix |
|---|---|---|---|---|
| Underfitting | Low | Low | High bias | Bigger model, more features, less regularization, train longer |
| Overfitting | High | Much lower | High variance | More data, regularization, dropout, simpler model, augmentation, early stopping |
| Good fit | High | Close to train | -- | Ship it |

Plot a **learning curve** (`sklearn.model_selection.learning_curve`) to see whether more data would help.

## Section 6: Hyperparameter Tuning & Feature Selection

### Search Strategies

```python
from sklearn.model_selection import GridSearchCV, RandomizedSearchCV
from scipy.stats import loguniform, randint

param_grid = {
    "model__C": [0.01, 0.1, 1, 10],          # step name + double underscore + param
    "model__penalty": ["l2"],
}
search = GridSearchCV(clf, param_grid, cv=5, scoring="f1", n_jobs=-1)
search.fit(X_train, y_train)
search.best_params_, search.best_score_
best = search.best_estimator_                  # already refit on all training data

# Random search is usually more efficient for many parameters
rs = RandomizedSearchCV(
    RandomForestClassifier(random_state=SEED),
    {"n_estimators": randint(100, 800), "max_depth": randint(3, 20),
     "min_samples_leaf": randint(1, 20)},
    n_iter=40, cv=5, scoring="roc_auc", n_jobs=-1, random_state=SEED,
)
```

For larger searches, use **Optuna**: it samples smartly and prunes bad trials early.

```python
import optuna

def objective(trial):
    params = {
        "learning_rate": trial.suggest_float("learning_rate", 1e-3, 0.3, log=True),
        "max_depth": trial.suggest_int("max_depth", 3, 10),
        "subsample": trial.suggest_float("subsample", 0.5, 1.0),
    }
    model = xgb.XGBClassifier(n_estimators=300, **params)
    return cross_val_score(model, X_train, y_train, cv=5, scoring="roc_auc").mean()

study = optuna.create_study(direction="maximize")
study.optimize(objective, n_trials=50)
study.best_params
```

### Feature Importance and Selection

```python
# Tree-based importance (fast, can be biased toward high-cardinality features)
model.feature_importances_

# Permutation importance (model-agnostic, computed on held-out data)
from sklearn.inspection import permutation_importance
r = permutation_importance(model, X_val, y_val, n_repeats=10, random_state=SEED)
r.importances_mean

# Selection
from sklearn.feature_selection import SelectKBest, f_classif, RFE, SelectFromModel
SelectKBest(f_classif, k=10)
SelectFromModel(Lasso(alpha=0.01))      # keep features with non-zero weight

# Explanations
import shap
explainer = shap.TreeExplainer(model)
shap.summary_plot(explainer.shap_values(X_val), X_val)
```

## Section 7: Unsupervised Learning

### Clustering

```python
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.metrics import silhouette_score

km = KMeans(n_clusters=4, n_init="auto", random_state=SEED).fit(X_scaled)
km.labels_, km.cluster_centers_, km.inertia_

# Pick k: try several and compare silhouette (higher is better) or the elbow of inertia
for k in range(2, 10):
    labels = KMeans(k, n_init="auto", random_state=SEED).fit_predict(X_scaled)
    print(k, silhouette_score(X_scaled, labels))

DBSCAN(eps=0.5, min_samples=5)           # density-based; label -1 = noise
AgglomerativeClustering(n_clusters=4, linkage="ward")
```

| Algorithm | Needs k? | Cluster shape | Handles noise | Scales to big data |
|---|---|---|---|---|
| K-Means | Yes | Spherical, similar size | No | Yes |
| DBSCAN | No (needs `eps`) | Arbitrary | Yes | Moderate |
| Hierarchical | Cut dendrogram | Depends on linkage | No | Poorly |
| Gaussian Mixture | Yes | Elliptical, soft assignments | Somewhat | Yes |

Always **scale features** before distance-based clustering.

### Dimensionality Reduction

```python
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
import umap

pca = PCA(n_components=0.95)             # keep 95% of the variance
Z = pca.fit_transform(X_scaled)
pca.explained_variance_ratio_

TSNE(n_components=2, perplexity=30, random_state=SEED).fit_transform(X_scaled)
umap.UMAP(n_components=2, n_neighbors=15).fit_transform(X_scaled)
```

* **PCA**: linear, fast, keeps global structure; good for preprocessing.
* **t-SNE / UMAP**: non-linear, for **visualization only**. Distances between clusters in t-SNE plots are not meaningful.

### Anomaly Detection

```python
from sklearn.ensemble import IsolationForest
iso = IsolationForest(contamination=0.01, random_state=SEED).fit(X)
iso.predict(X)                # 1 = normal, -1 = anomaly
iso.score_samples(X)          # lower = more anomalous
```

## Section 8: Deep Learning Fundamentals

### Core Ideas

| Concept | Meaning |
|---|---|
| Forward pass | Compute predictions from inputs, layer by layer |
| Loss | A single number measuring how wrong the predictions are |
| Backward pass (backprop) | Chain rule computes the gradient of the loss w.r.t. every parameter |
| Optimizer step | Update parameters using gradients: `w <- w - lr * grad` (plus momentum, etc.) |
| Epoch | One full pass over the training set |
| Batch / mini-batch | Subset of samples used for one gradient step |
| Iteration | One optimizer step (one batch) |

### Activation Functions

| Activation | Formula | Use | Notes |
|---|---|---|---|
| ReLU | `max(0, x)` | Default for hidden layers | Can "die" for negative inputs |
| Leaky ReLU | `max(0.01x, x)` | Fixes dying ReLU | |
| GELU | `x * Phi(x)` | Transformers | Smooth ReLU variant |
| SiLU / Swish | `x * sigmoid(x)` | Modern CNNs, LLMs | |
| Sigmoid | `1 / (1 + e^-x)` | Binary output probability | Saturates; avoid in deep hidden layers |
| Tanh | `(e^x - e^-x) / (e^x + e^-x)` | RNN gates, outputs in `[-1, 1]` | Saturates |
| Softmax | `e^xi / sum(e^xj)` | Multi-class output | Often folded into the loss |

### Loss Functions: Match the Output Layer

| Task | Output layer | PyTorch loss | Targets |
|---|---|---|---|
| Regression | Linear (no activation) | `nn.MSELoss`, `nn.L1Loss`, `nn.HuberLoss` | floats |
| Binary classification | 1 logit | `nn.BCEWithLogitsLoss` | floats 0/1, shape like logits |
| Multi-class | `C` logits | `nn.CrossEntropyLoss` | **class indices** (long), shape `(N,)` |
| Multi-label | `C` logits | `nn.BCEWithLogitsLoss` | floats multi-hot `(N, C)` |
| Segmentation | `C` channels | `nn.CrossEntropyLoss` / Dice | index mask `(N, H, W)` |

> `CrossEntropyLoss` and `BCEWithLogitsLoss` apply softmax / sigmoid **internally**. Feed them raw logits. Adding your own softmax before them is a classic bug.

### Optimizers

| Optimizer | Typical lr | Notes |
|---|---|---|
| `SGD(momentum=0.9)` | 0.01 to 0.1 | Strong generalization for CNNs with a good schedule |
| `Adam` | 1e-3 to 1e-4 | Fast default; good out of the box |
| `AdamW` | 1e-3 to 1e-5 | Adam with **decoupled** weight decay; preferred for transformers |
| `RMSprop` | 1e-3 | Sometimes used for RNNs |

Weight initialization: PyTorch defaults are fine for most layers; use `nn.init.kaiming_normal_` for ReLU nets and `nn.init.xavier_uniform_` for tanh/sigmoid.

## Section 9: PyTorch Essentials

### Tensors

```python
x = torch.tensor([[1., 2.], [3., 4.]])
torch.zeros(3, 4); torch.ones(2, 2); torch.randn(3, 4); torch.arange(10)
x.shape, x.dtype, x.device

x.to(device)                  # move to GPU / CPU
x.float(); x.long()           # change dtype
x.view(-1, 4)                 # reshape (needs contiguous memory)
x.reshape(-1, 4)              # reshape (copies if needed)
x.permute(0, 2, 1)            # reorder dimensions
x.unsqueeze(0); x.squeeze()   # add / remove size-1 dims

torch.from_numpy(arr)         # shares memory with the array
x.detach().cpu().numpy()      # tensor -> NumPy (must detach and be on CPU)
x.item()                      # one-element tensor -> Python number
```

### Autograd

```python
w = torch.randn(3, requires_grad=True)
loss = (w ** 2).sum()
loss.backward()               # fills w.grad
w.grad

with torch.no_grad():         # disable gradient tracking (inference, evaluation)
    preds = model(x)

# Gradients ACCUMULATE; clear them before each backward pass
optimizer.zero_grad()
```

### Dataset and DataLoader

```python
class TabularDataset(Dataset):
    def __init__(self, X, y):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.long)

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]

train_loader = DataLoader(TabularDataset(X_train, y_train),
                          batch_size=64, shuffle=True,
                          num_workers=4, pin_memory=True)
val_loader = DataLoader(TabularDataset(X_val, y_val), batch_size=256, shuffle=False)
```

### Defining a Model

```python
class MLP(nn.Module):
    def __init__(self, in_dim, hidden, n_classes, p=0.3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden),
            nn.BatchNorm1d(hidden),
            nn.ReLU(),
            nn.Dropout(p),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
            nn.Linear(hidden, n_classes),      # raw logits, no softmax
        )

    def forward(self, x):
        return self.net(x)

model = MLP(in_dim=20, hidden=128, n_classes=3).to(device)
sum(p.numel() for p in model.parameters() if p.requires_grad)   # parameter count
```

### The Training Loop

```python
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-2)

def train_one_epoch(model, loader):
    model.train()                                  # enables dropout, batchnorm updates
    total, correct, running = 0, 0, 0.0
    for xb, yb in loader:
        xb, yb = xb.to(device), yb.to(device)

        optimizer.zero_grad()                      # 1. clear old gradients
        logits = model(xb)                         # 2. forward
        loss = criterion(logits, yb)               # 3. loss
        loss.backward()                            # 4. backward
        optimizer.step()                           # 5. update weights

        running += loss.item() * xb.size(0)
        correct += (logits.argmax(1) == yb).sum().item()
        total += xb.size(0)
    return running / total, correct / total

@torch.no_grad()
def evaluate(model, loader):
    model.eval()                                   # disables dropout, uses running BN stats
    total, correct, running = 0, 0, 0.0
    for xb, yb in loader:
        xb, yb = xb.to(device), yb.to(device)
        logits = model(xb)
        running += criterion(logits, yb).item() * xb.size(0)
        correct += (logits.argmax(1) == yb).sum().item()
        total += xb.size(0)
    return running / total, correct / total

best_val = float("inf")
for epoch in range(50):
    tr_loss, tr_acc = train_one_epoch(model, train_loader)
    va_loss, va_acc = evaluate(model, val_loader)
    print(f"{epoch:02d} train {tr_loss:.4f}/{tr_acc:.3f}  val {va_loss:.4f}/{va_acc:.3f}")
    if va_loss < best_val:                         # keep the best checkpoint
        best_val = va_loss
        torch.save(model.state_dict(), "best.pt")
```

### Saving and Loading

```python
torch.save(model.state_dict(), "model.pt")                    # weights only (recommended)
model = MLP(20, 128, 3)
model.load_state_dict(torch.load("model.pt", map_location=device))
model.eval()

# Full checkpoint to resume training
torch.save({"model": model.state_dict(), "opt": optimizer.state_dict(), "epoch": epoch}, "ckpt.pt")
```

## Section 10: Neural Network Architectures

### Layer Reference

| Layer | Code | Input -> output |
|---|---|---|
| Fully connected | `nn.Linear(in, out)` | `(N, in)` -> `(N, out)` |
| 2-D convolution | `nn.Conv2d(c_in, c_out, kernel_size=3, padding=1)` | `(N, c_in, H, W)` -> `(N, c_out, H, W)` |
| Max pooling | `nn.MaxPool2d(2)` | halves `H` and `W` |
| Global pooling | `nn.AdaptiveAvgPool2d(1)` | `(N, C, H, W)` -> `(N, C, 1, 1)` |
| Batch norm | `nn.BatchNorm2d(c)` / `nn.BatchNorm1d(f)` | same shape; train vs eval behave differently |
| Layer norm | `nn.LayerNorm(d)` | same shape; used in transformers |
| Dropout | `nn.Dropout(p)` | same shape; active only in `train()` |
| Embedding | `nn.Embedding(vocab, dim)` | `(N, L)` ints -> `(N, L, dim)` |
| LSTM | `nn.LSTM(in, hid, num_layers, batch_first=True)` | `(N, L, in)` -> `(N, L, hid)` |
| GRU | `nn.GRU(in, hid, batch_first=True)` | like LSTM, fewer parameters |
| Multi-head attention | `nn.MultiheadAttention(d, heads, batch_first=True)` | `(N, L, d)` -> `(N, L, d)` |
| Flatten | `nn.Flatten()` | `(N, C, H, W)` -> `(N, C*H*W)` |

Convolution output size: `out = floor((in + 2*padding - kernel) / stride) + 1`.

### CNN for Images

```python
class SmallCNN(nn.Module):
    def __init__(self, n_classes=10):
        super().__init__()
        def block(c_in, c_out):
            return nn.Sequential(
                nn.Conv2d(c_in, c_out, 3, padding=1),
                nn.BatchNorm2d(c_out),
                nn.ReLU(),
                nn.MaxPool2d(2),
            )
        self.features = nn.Sequential(block(3, 32), block(32, 64), block(64, 128))
        self.head = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Dropout(0.3),
            nn.Linear(128, n_classes),
        )

    def forward(self, x):
        return self.head(self.features(x))
```

### Sequence Model (LSTM Classifier)

```python
class LSTMClassifier(nn.Module):
    def __init__(self, vocab, emb=128, hid=256, n_classes=2):
        super().__init__()
        self.emb = nn.Embedding(vocab, emb, padding_idx=0)
        self.lstm = nn.LSTM(emb, hid, num_layers=2, batch_first=True,
                            bidirectional=True, dropout=0.3)
        self.fc = nn.Linear(hid * 2, n_classes)

    def forward(self, tokens):                       # tokens: (N, L)
        out, (h, c) = self.lstm(self.emb(tokens))
        last = torch.cat([h[-2], h[-1]], dim=1)      # final forward + backward states
        return self.fc(last)
```

### Transformer Building Blocks

```python
# Scaled dot-product attention: softmax(Q K^T / sqrt(d_k)) V
def attention(q, k, v, mask=None):
    scores = q @ k.transpose(-2, -1) / (q.size(-1) ** 0.5)
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float("-inf"))
    return F.softmax(scores, dim=-1) @ v

encoder_layer = nn.TransformerEncoderLayer(d_model=256, nhead=8,
                                           dim_feedforward=1024, dropout=0.1,
                                           batch_first=True, norm_first=True)
encoder = nn.TransformerEncoder(encoder_layer, num_layers=4)
```

| Architecture | Best for | Key idea |
|---|---|---|
| MLP | Tabular data | Stacked dense layers |
| CNN | Images, local patterns | Shared filters, translation equivariance |
| RNN / LSTM / GRU | Short sequences, streaming | Hidden state carried across time |
| Transformer | Text, long-range dependencies, vision (ViT) | Self-attention, parallel over positions |
| Autoencoder / VAE | Compression, anomaly detection, generation | Encoder -> bottleneck -> decoder |
| GAN / Diffusion | Image generation | Adversarial game / iterative denoising |
| GNN | Graph-structured data | Message passing between neighbours |

## Section 11: Training Techniques

### Regularization Toolbox

| Technique | How | When |
|---|---|---|
| Weight decay | `AdamW(weight_decay=1e-2)` | Almost always |
| Dropout | `nn.Dropout(0.1 to 0.5)` | Dense layers, transformers |
| Early stopping | Stop when val loss stops improving for `patience` epochs | Always |
| Data augmentation | Flips, crops, color jitter, mixup, noise | Images, audio; best regularizer when data is scarce |
| Batch norm | `nn.BatchNorm*` | CNNs; also speeds up training |
| Label smoothing | `CrossEntropyLoss(label_smoothing=0.1)` | Overconfident classifiers |
| Smaller model / fewer features | -- | If overfitting persists |

### Learning-Rate Schedules and Gradient Clipping

```python
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
# or reduce on plateau
scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, factor=0.5, patience=3)
# or one-cycle (step per batch)
scheduler = torch.optim.lr_scheduler.OneCycleLR(optimizer, max_lr=1e-2,
                                                total_steps=epochs * len(train_loader))

# in the loop
loss.backward()
torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)   # prevents exploding gradients
optimizer.step()
scheduler.step()                  # per epoch (or per batch for OneCycleLR)
                                  # ReduceLROnPlateau: scheduler.step(val_loss)
```

### Mixed Precision and Speed

```python
scaler = torch.amp.GradScaler("cuda")

for xb, yb in train_loader:
    xb, yb = xb.to(device, non_blocking=True), yb.to(device, non_blocking=True)
    optimizer.zero_grad(set_to_none=True)
    with torch.autocast(device_type="cuda", dtype=torch.float16):
        loss = criterion(model(xb), yb)
    scaler.scale(loss).backward()
    scaler.step(optimizer)
    scaler.update()

model = torch.compile(model)      # PyTorch 2.x graph compilation
```

* Use `DataLoader(num_workers>0, pin_memory=True)` so the GPU is never waiting on data.
* **Gradient accumulation** simulates a large batch: call `optimizer.step()` every `k` batches and divide the loss by `k`.

### Early Stopping Helper

```python
class EarlyStopping:
    def __init__(self, patience=5, min_delta=0.0):
        self.patience, self.min_delta = patience, min_delta
        self.best, self.counter = float("inf"), 0

    def step(self, val_loss):
        if val_loss < self.best - self.min_delta:
            self.best, self.counter = val_loss, 0
            return False                    # keep training
        self.counter += 1
        return self.counter >= self.patience   # True -> stop
```

### Transfer Learning

```python
import torchvision

model = torchvision.models.resnet50(weights="IMAGENET1K_V2")

for p in model.parameters():          # freeze the backbone
    p.requires_grad = False

model.fc = nn.Linear(model.fc.in_features, n_classes)   # new trainable head

optimizer = torch.optim.AdamW(model.fc.parameters(), lr=1e-3)   # train head first
# Then unfreeze some layers and fine-tune everything with a much lower lr (1e-5 to 1e-4)
```

Standard recipe: **freeze -> train the head -> unfreeze -> fine-tune with a small learning rate**. Always use the same input normalization the pretrained model expected (ImageNet mean/std for torchvision).

### Image Augmentation

```python
from torchvision import transforms as T

train_tf = T.Compose([
    T.RandomResizedCrop(224),
    T.RandomHorizontalFlip(),
    T.ColorJitter(0.2, 0.2, 0.2),
    T.ToTensor(),
    T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])
val_tf = T.Compose([T.Resize(256), T.CenterCrop(224), T.ToTensor(),
                    T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])])
```

Augment the **training** set only; validation and test use deterministic transforms.

## Section 12: Hugging Face Transformers

### Pipelines and Fine-Tuning

```python
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification

# Zero-setup inference
clf = pipeline("sentiment-analysis")
clf("This cheat sheet is great")

# Manual usage
name = "distilbert-base-uncased"
tok = AutoTokenizer.from_pretrained(name)
model = AutoModelForSequenceClassification.from_pretrained(name, num_labels=2)

batch = tok(["hello world", "bad movie"], padding=True, truncation=True,
            max_length=128, return_tensors="pt")
with torch.no_grad():
    logits = model(**batch).logits

# Trainer API
from transformers import Trainer, TrainingArguments
args = TrainingArguments(output_dir="out", num_train_epochs=3,
                         per_device_train_batch_size=16, learning_rate=2e-5,
                         eval_strategy="epoch", weight_decay=0.01)
trainer = Trainer(model=model, args=args,
                  train_dataset=train_ds, eval_dataset=val_ds)
trainer.train()
```

| Task | Auto class | Pipeline name |
|---|---|---|
| Text classification | `AutoModelForSequenceClassification` | `text-classification` |
| Token classification (NER) | `AutoModelForTokenClassification` | `ner` |
| Question answering | `AutoModelForQuestionAnswering` | `question-answering` |
| Text generation | `AutoModelForCausalLM` | `text-generation` |
| Summarization / translation | `AutoModelForSeq2SeqLM` | `summarization` / `translation` |
| Embeddings | `AutoModel` (mean-pool hidden states) | `feature-extraction` |

## Section 13: Keras / TensorFlow Quick Reference

### Build, Compile, Fit

```python
import keras
from keras import layers

model = keras.Sequential([
    layers.Input(shape=(20,)),
    layers.Dense(128, activation="relu"),
    layers.Dropout(0.3),
    layers.Dense(3, activation="softmax"),
])

model.compile(optimizer=keras.optimizers.Adam(1e-3),
              loss="sparse_categorical_crossentropy",   # integer labels
              metrics=["accuracy"])

history = model.fit(
    X_train, y_train,
    validation_split=0.2, epochs=50, batch_size=64,
    callbacks=[
        keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=3),
        keras.callbacks.ModelCheckpoint("best.keras", save_best_only=True),
    ],
)
model.evaluate(X_test, y_test)
model.predict(X_new)
```

| Loss | Labels | Final activation |
|---|---|---|
| `binary_crossentropy` | 0/1 | `sigmoid` |
| `categorical_crossentropy` | one-hot | `softmax` |
| `sparse_categorical_crossentropy` | integers | `softmax` |
| `mse` | floats | none |

## Section 14: Debugging & Common Pitfalls

### Debugging a Network That Will Not Learn

1. **Overfit one small batch** (8 to 32 samples). If loss will not go to ~0, there is a bug in the model, loss, or labels.
2. Check the **initial loss**: for `C` classes it should be near `ln(C)` (about 2.30 for 10 classes).
3. Verify shapes and dtypes at each layer (`print(x.shape)` inside `forward`).
4. Inspect a few inputs and labels as the model actually sees them (after transforms).
5. Lower the learning rate by 10x; then try raising it. Learning rate is the most sensitive knob.
6. Watch gradient norms; `NaN` loss usually means too high lr, `log(0)`, or bad data.
7. Only then scale up: more data, bigger model, longer training.

### Pitfall Table

| Pitfall | Symptom | Fix |
|---|---|---|
| Forgot `model.eval()` | Noisy / worse validation results | Call `model.eval()` and use `torch.no_grad()` |
| Forgot `optimizer.zero_grad()` | Loss behaves erratically | Zero gradients every step |
| Softmax before `CrossEntropyLoss` | Poor training, wrong loss | Pass raw logits |
| Wrong target dtype | `expected scalar type Long` | Class targets are `long`; BCE targets are `float` |
| Model and data on different devices | `Expected all tensors on same device` | `.to(device)` for both |
| Scaler fit on all data | Test score too optimistic | Fit inside a `Pipeline` on train only |
| Target leakage | Near-perfect CV, awful in production | Remove features unavailable at prediction time |
| Shuffled time series | Inflated scores | Split by time, `TimeSeriesSplit` |
| Same entity in train and test | Inflated scores | `GroupKFold` / group split |
| Tuning on the test set | Optimistic final score | Tune on validation/CV; test once |
| Accuracy on imbalanced data | "95% accurate" model predicts only the majority | Use F1, PR-AUC, recall; class weights |
| Storing tensors with graph in a list | GPU memory grows each step | Use `loss.item()` or `.detach()` |
| BatchNorm with batch size 1 | Error or unstable results | Larger batches, or GroupNorm/LayerNorm |
| Not setting seeds | Results cannot be reproduced | Seed NumPy, torch, and the data split |

### Quick Decision Guide

| Situation | Reach for |
|---|---|
| Tabular data, any size | Gradient boosting (LightGBM / XGBoost) first, MLP only if needed |
| Small dataset (< 1k rows) | Regularized linear model, random forest, SVM |
| Images | Pretrained CNN / ViT with fine-tuning |
| Text | Pretrained transformer via Hugging Face |
| Time series | Gradient boosting on lag features, then LSTM / Temporal CNN / Transformer |
| Need interpretability | Linear model, shallow tree, SHAP on boosted trees |
| No labels | Clustering, PCA, autoencoders, or self-supervised pretraining |
| Heavily imbalanced classes | Class weights, threshold tuning, PR-AUC |

### Saving the Whole Pipeline (scikit-learn)

```python
import joblib
joblib.dump(clf, "pipeline.joblib")        # preprocessing + model together
clf = joblib.load("pipeline.joblib")
clf.predict(new_df)
```
