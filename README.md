### dev/creator = Sahhhiiillllll

## 3D Order Book Liquidity Simulator — Market Microstructure Lab

This repository now includes a Vercel-ready static deployment implementation alongside the original Streamlit source.

### Vercel Deployment
1. Connect this repository to Vercel.
2. Vercel will detect the static site using `index.html`.
3. The `vercel.json` configuration routes all traffic to the static entry point.

### Local Usage
Install dependencies for the Python Streamlit app:
```bash
pip install -r requirements.txt
```
Run the original Streamlit app locally:
```bash
streamlit run streamlit_3d_orderbook_lab.py
```

### Project Files
- `index.html` — root entry point for the Vercel deployment
- `app.js` — browser-side simulation engine and Plotly visualizer
- `styles.css` — dark theme UI for the dashboard
- `streamlit_3d_orderbook_lab.py` — original Streamlit app
- `vercel.json` — Vercel routing and build config
- `requirements.txt` — Python dependencies for local development

### Features
- Static Vercel deployment via `index.html`
- Interactive 3D Plotly surface visualization
- Slider controls for Mid Price, Volatility, Imbalance, Spoofing, and Flash Crash
- Real-time imbalance and liquidity metrics
- Responsive dark UI

---



