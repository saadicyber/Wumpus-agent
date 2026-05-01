# 🤖 Wumpus World — Dynamic Propositional Logic Agent

> A Knowledge-Based AI Agent that navigates a randomly generated Wumpus World using a fully implemented Propositional Logic Inference Engine with Resolution Refutation.

![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow?style=flat-square&logo=javascript)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)

---

## 🔗 Links

| Resource | Link |
|---|---|
| 🌐 Live Demo | [Click Here](https://wumpus-agent-rho.vercel.app) |
| 💻 GitHub | [Click Here](https://github.com/saadicyber/Wumpus-agent) |


---

## 📌 Project Overview

This project implements a **Knowledge-Based Agent** that navigates a Wumpus World-style grid. The agent:

- Does **not** know the location of Pits or the Wumpus at the start
- Receives **percepts** (Breeze, Stench, Glitter) as it explores
- Uses **Propositional Logic** to deduce which cells are safe
- Proves safety using **Resolution Refutation** before moving

---

## 🎮 Features

- **Dynamic Grid Sizing** — choose any grid from 3x3 up to 7x7
- **Random Hazard Placement** — Pits and Wumpus placed randomly each episode
- **Real-Time Percept Generation** — Breeze near Pits, Stench near Wumpus, Glitter on Gold
- **Propositional Knowledge Base** — TELL/ASK API with CNF clause storage
- **Resolution Refutation Engine** — proves Not-Pit AND Not-Wumpus before each move
- **Step-by-Step Replay** — watch every single move the agent makes
- **Real-Time Metrics Dashboard** — inference steps, percepts, visited/safe/unsafe counts
- **Auto-Play** — watch the agent run automatically at adjustable speed

---

## 🧠 How the Inference Engine Works

### 1. Knowledge Base (TELL)

When the agent visits a cell, it tells the KB what it perceived:

- **No Breeze** at (r,c) — assert Not-Pit for all adjacent cells (unit clause)
- **Breeze** at (r,c) — add biconditional rule in CNF:

```
B_r_c <=> (P_r1_c1 OR P_r2_c2 OR ...)
```

Converted to CNF clauses:
```
(NOT-B OR P1 OR P2 OR ...) AND (B OR NOT-P1) AND (B OR NOT-P2) AND ...
```

- Same logic applies for **Stench** and Wumpus variables

### 2. Resolution Refutation (ASK)

Before moving to a cell (r,c), the agent asks:
```
Is NOT-Pit_r_c provable?   AND   Is NOT-Wumpus_r_c provable?
```

The resolution loop:
1. Add the negation of the query to the working clause set
2. Iteratively resolve all pairs of clauses
3. If the **empty clause** is derived — contradiction found — query is proved
4. If no contradiction after exhausting all resolvents — cannot prove safety

### 3. Safe Cell Decision

A cell is marked **Safe (green)** only if both proofs succeed:
```
ASK(NOT-Pit_r_c) = TRUE   AND   ASK(NOT-Wumpus_r_c) = TRUE
```

---

## 🗂️ Project Structure

```
wumpus-agent/
├── public/
│   └── index.html
├── src/
│   ├── App.js          <- Entire application (KB + Agent + UI)
│   └── index.js
├── package.json
└── README.md
```

### Key Components inside App.js

| Component | Description |
|---|---|
| KB class | Knowledge Base — stores CNF clauses, implements TELL and ASK |
| resolve() | Resolves two clauses, returns new resolvents |
| buildWorld() | Generates random grid with Pits, Wumpus, Gold |
| getPercepts() | Returns Breeze/Stench/Glitter for a given cell |
| runAgent() | Runs full BFS agent episode, records one snapshot per move |
| App component | React UI — grid, controls, metrics dashboard |

---

## 🚀 Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-username/wumpus-agent.git

# 2. Go into the project folder
cd wumpus-agent

# 3. Install dependencies
npm install

# 4. Start the development server
npm start
```

Open https://wumpus-agent-rho.vercel.app in your browser.

---

## ☁️ Deployment

This project is deployed on **Vercel**.

To deploy your own version:
```bash
npm install -g vercel
vercel
```

---

## 🕹️ How to Use

1. Set **Rows**, **Cols**, and number of **Pits** using the sliders
2. Click **New Episode** to generate a new world and run the agent
3. Use the step buttons or arrow keys to replay each move
4. Press **Space** to auto-play
5. Watch the grid update in real time — green = safe, red = hazard

---

## 📊 Grid Color Guide

| Color | Meaning |
|---|---|
| Teal | Agent has visited this cell |
| Dark Green | KB proved this cell is safe |
| Dark Red | KB proved this cell is dangerous |
| Dark/Black | Unknown — not yet visited or inferred |

---

## ⚙️ Technical Decisions

- **Pure JavaScript** — no external AI or logic libraries used
- **Hard cap of 2000 resolution steps** per query — prevents browser freeze on large grids
- **BFS traversal** — agent always visits nearest safe cell first
- **One snapshot per move** — ensures step-by-step replay shows exactly one cell movement at a time

---

