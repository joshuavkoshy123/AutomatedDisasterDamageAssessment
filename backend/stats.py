import numpy as np

labels = ['no-damage', 'minor-damage', 'major-damage', 'destroyed']

cm = np.array([
    [3642,  259,   266,   0],
    [ 716,   51,   104,   0],
    [1123,   93,  1155,   0],
    [  69,   10,   117,   0],
])

def compute_metrics(cm, labels):
    results = []

    for i, label in enumerate(labels):
        tp = cm[i, i]
        fn = cm[i, :].sum() - tp
        fp = cm[:, i].sum() - tp
        tn = cm.sum() - (tp + fn + fp)

        precision = tp / (tp + fp) if (tp + fp) else 0
        recall = tp / (tp + fn) if (tp + fn) else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0

        results.append({
            "label": label,
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "support": cm[i].sum()
        })

    return results

metrics = compute_metrics(cm, labels)

for m in metrics:
    print(m)

accuracy = np.trace(cm) / np.sum(cm)
print("Accuracy:", accuracy)

macro_precision = np.mean([m["precision"] for m in metrics])
macro_recall = np.mean([m["recall"] for m in metrics])
macro_f1 = np.mean([m["f1"] for m in metrics])

print("Macro Precision:", macro_precision)
print("Macro Recall:", macro_recall)
print("Macro F1:", macro_f1)