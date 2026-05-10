# Current Planning Index

The active Contractor Hub roadmap is now tracked in the root documentation:

- `README.md` for the current product overview and development commands.
- `ARCHITECTURE_PLAN.md` for the component-based architecture doctrine.
- `CONTRACTOR_GRADE_ROADMAP.md` for subsystem grades and Steps 6-10.
- the UX layout standard in `README.md` and `CONTRACTOR_GRADE_ROADMAP.md` for adaptive full-window and partial-window behavior.


Older roadmap language about the previous prototype layout is obsolete. The active app is organized around:

- `client/src/bim`
- `client/src/editor`
- `client/src/stores`
- `server/src`
- `tests`

Current editor planning assumes adaptive panels: wide screens show mode rail, tools, canvas/3D, and inspector together; partial windows collapse tools and inspector into readable drawers or bottom sheets without changing BIM source-of-truth contracts.
