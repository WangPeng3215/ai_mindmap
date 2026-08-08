# MindFlow proposal payloads

## Full map

Use only for intentional whole-map creation or replacement.

```json
{
  "baseRevision": 3,
  "scope": "map",
  "message": "Generate the product plan mind map",
  "reply": "Organized the analysis into goals, users, scope, risks, and actions.",
  "document": {
    "title": "Product plan",
    "layoutMode": "left-right",
    "root": {
      "id": "product-plan",
      "text": "Product plan",
      "children": [
        {
          "id": "goals",
          "text": "Goals",
          "side": "right",
          "children": [
            { "id": "goal-adoption", "text": "Increase adoption" }
          ]
        }
      ]
    }
  }
}
```

`layoutMode` is `left-right`, `top-bottom`, or `architecture`.

## Incremental map update

```json
{
  "baseRevision": 3,
  "scope": "map",
  "message": "Add delivery risks and actions",
  "reply": "Added two risk nodes and an action branch.",
  "operations": [
    { "type": "add_node", "parentId": "risks", "node": { "id": "risk-schedule", "text": "Schedule risk" } },
    { "type": "update_node", "id": "owner", "patch": { "text": "Delivery owner", "notes": "Accountable for launch readiness" } },
    { "type": "move_node", "id": "actions", "parentId": "root", "index": 2, "side": "right" },
    { "type": "delete_node", "id": "obsolete" }
  ]
}
```

Allowed `update_node.patch` fields: `text`, `notes`, `collapsed`, `color`, `position`, and `side`.

## Selected branch update

```json
{
  "baseRevision": 3,
  "scope": "branch",
  "targetNodeId": "risks",
  "message": "Expand the selected risk branch",
  "operations": [
    { "type": "add_node", "parentId": "risks", "node": { "id": "risk-budget", "text": "Budget risk" } }
  ]
}
```

Branch operations may reference only the selected node and its descendants. New child IDs become valid targets for later operations in the same ordered batch.
