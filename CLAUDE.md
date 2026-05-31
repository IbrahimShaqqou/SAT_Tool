# Design Context

This is **ZooPrep**, a Digital SAT tutoring platform (React 18 SPA in `frontend/`, FastAPI backend in `backend/`).

- **Register:** `product` (app UI for students and tutors). The marketing landing page may be treated as `brand` per-task.
- **Strategic context:** see [PRODUCT.md](./PRODUCT.md) for users, purpose, personality, anti-references, and design principles.
- **Design principles (short form):** lower the stakes · show the path, not just the score · earn premium through restraint · two audiences, one system · test fidelity is sacred.
- **Visual system:** Tailwind with semantic tokens (`surface-*`, `ink-*`, `edge-*`), a cyan-teal brand + mint-emerald accent palette, Inter type, first-class dark mode. Use the semantic tokens, not raw `bg-white dark:bg-slate-800` patterns.

Run `/impeccable document` to generate a full DESIGN.md from the frontend when needed.
