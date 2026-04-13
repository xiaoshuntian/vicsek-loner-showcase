# Vicsek-Loner Showcase

[中文说明 / Chinese Version](./README.zh-CN.md)

A lightweight GitHub-friendly demo for visualizing a small-scale version of the `Vicsek + evolutionary game + loner` model used in this project.

The goal is not to replace the MATLAB research code. Instead, this repo gives a compact and interactive explanation of what the agents are actually doing in space:

- agents move in a periodic 2D box
- neighbors are defined by radius `r`
- cooperators and loners align with the local average heading
- defectors move with random headings
- strategy updates follow a Fermi imitation rule
- loners copy with an extra factor `p`

The default demo runs `10` agents for `20` rounds so the evolution is easy to inspect visually.

## Quick look

You can watch the demo video directly inside this repository page:

<video src="./assets/Video.mp4" controls preload="metadata" width="900"></video>

If your GitHub client does not render the video inline, open it here: [`assets/Video.mp4`](./assets/Video.mp4)

## Why this repo exists

In the MATLAB experiments, we mostly see aggregate outputs such as:

- global order parameter `Va`
- cooperation level
- strategy frequencies

Those figures are useful, but they do not immediately answer a very natural question:

`What do the agents actually look like while they evolve?`

This repository is meant to answer that question directly.

## Mapping to the MATLAB code

The interactive rules in this demo are intentionally aligned with the current MATLAB implementation in:

- `simulation_loner.m`
- `is_neighbour.m`
- `neighbour_to_imitate.m`

The simplified browser demo keeps the same logic:

1. Position update
   Agents move with constant speed `v0` in a periodic square box.

2. Neighbor detection
   Two agents are neighbors when their periodic distance is smaller than `r`.

3. Heading update
   - `C` and `L` align with the local average heading plus noise `eta`
   - `D` chooses a random new heading

4. Payoff update
   - local order `Va_i` is computed from the current neighborhood
   - cost is proportional to communication radius
   - payoff is `Va_i - alpha * cost`

5. Strategy update
   Each agent samples one neighbor and imitates under the Fermi rule.
   Loners use `p * FermiProb`.

This makes the demo a faithful explanatory visualization, while staying small enough to run instantly in a browser.

## Repo contents

- `index.html`: single-page demo
- `styles.css`: page styling
- `app.js`: simulation, animation, charts, and controls

## Live links

- Repository: `https://github.com/xiaoshuntian/vicsek-loner-showcase`
- Demo video: `./assets/Video.mp4`
- GitHub Pages: `https://xiaoshuntian.github.io/vicsek-loner-showcase/`

## How to use

Open `index.html` in a browser.

Controls let you change:

- number of agents
- number of rounds
- radius `r`
- loner imitation factor `p`
- relative cost `alpha`
- noise `eta`
- speed `v0`
- random seed

Buttons:

- `Reset`: create a fresh simulation with the current parameters
- `Play`: animate the run
- `Step`: advance one round
- `Run 20 Rounds`: finish the full rollout immediately

## What the page shows

The landing page is organized into three parts:

1. A hero section that explains the model and now includes a playable demo video.
2. A spatial animation panel that shows where each agent is, which direction it is moving, and what interaction radius it currently uses.
3. Two small charts that summarize the evolving strategy frequencies and the time series of global `Va` and cooperation.

This layout is meant to help new readers understand both the micro-level motion and the macro-level statistics.

## Intended audience

This repository is designed for:

- teammates who want to understand the model before reading MATLAB code
- reviewers or mentors who want a visual explanation of the mechanism
- readers coming from GitHub or GitHub Pages who need a fast, intuitive introduction
- students who want a compact demo before running the larger simulations

## Suggested GitHub presentation

For a public-facing repository, the recommended structure is:

1. put this folder in a standalone GitHub repo
2. enable GitHub Pages
3. use `index.html` as the landing page
4. later add screenshots or MATLAB comparison figures if needed

## Future extensions

Good next upgrades:

- add a side-by-side comparison with MATLAB output snapshots
- export trajectory frames as GIFs
- add a parameter preset panel matching the paper figures
- add a second tab for larger `N` and longer runs
- add direct links to the core MATLAB files and the paper figure they correspond to

## Notes

This demo is designed for explanation and outreach.
The research-grade quantitative results should still come from the MATLAB codebase.
