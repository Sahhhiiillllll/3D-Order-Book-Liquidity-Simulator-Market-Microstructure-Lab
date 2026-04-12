import streamlit as st
import numpy as np
import plotly.graph_objs as go
import plotly.io as pio
import time

# Set Plotly dark theme
pio.templates.default = "plotly_dark"

# --- Sidebar Controls ---
st.set_page_config(
    page_title="3D Order Book Liquidity Simulator — Market Microstructure Lab",
    layout="wide",
    initial_sidebar_state="expanded",
    page_icon="💹"
)

st.sidebar.title("Simulation Controls")
mid_price = st.sidebar.slider("Mid Price", min_value=100, max_value=1000, value=500, step=1)
volatility = st.sidebar.slider("Volatility", min_value=0.01, max_value=0.2, value=0.05, step=0.01)
spoofing = st.sidebar.checkbox("Enable Spoofing", value=False)
flash_crash = st.sidebar.checkbox("Enable Flash Crash", value=False)
sim_speed = st.sidebar.slider("Simulation Speed (ms)", min_value=50, max_value=1000, value=200, step=10)
imbalance_intensity = st.sidebar.slider("Imbalance Intensity", min_value=0.0, max_value=1.0, value=0.2, step=0.01)

# --- Simulation Parameters ---
N_PRICE = 60  # Number of price levels
N_TIME = 80   # Number of time steps
PRICE_SPAN = 3.0  # Price range in % around mid

price_grid = np.linspace(mid_price * (1 - PRICE_SPAN/100), mid_price * (1 + PRICE_SPAN/100), N_PRICE)
time_grid = np.arange(N_TIME)

# --- Order Book Simulation Engine ---
def simulate_order_book(mid, vol, imb, spoof, crash):
    # Bid/Ask split
    mid_idx = N_PRICE // 2
    bid_levels = price_grid[:mid_idx]
    ask_levels = price_grid[mid_idx:]
    
    # Base volume profile: Gaussian around mid
    base_vol = np.exp(-((price_grid - mid)**2) / (2 * (vol * mid)**2))
    base_vol *= 1000  # Scale
    
    # Imbalance: shift volume from bid to ask
    bid_vol = base_vol[:mid_idx] * (1 + imb)
    ask_vol = base_vol[mid_idx:] * (1 - imb)
    
    # Time evolution
    volume_matrix = np.zeros((N_PRICE, N_TIME))
    for t in range(N_TIME):
        # Normal mode: random walk mid price
        mid_t = mid + np.random.normal(0, vol * mid)
        # Evolve base profile
        base_vol_t = np.exp(-((price_grid - mid_t)**2) / (2 * (vol * mid)**2)) * 1000
        bid_vol_t = base_vol_t[:mid_idx] * (1 + imb)
        ask_vol_t = base_vol_t[mid_idx:] * (1 - imb)
        
        # Spoofing: temporary volume spike
        if spoof and 10 < t < 30:
            spoof_idx = mid_idx + np.random.randint(-5, 5)
            if 0 <= spoof_idx < N_PRICE:
                bid_vol_t[spoof_idx if spoof_idx < mid_idx else -1] += 5000
                ask_vol_t[spoof_idx-mid_idx if spoof_idx >= mid_idx else 0] += 5000
        
        # Flash crash: sudden liquidity collapse
        if crash and 40 < t < 50:
            bid_vol_t *= 0.1
            ask_vol_t *= 0.1
            # Price displacement
            mid_t += np.random.normal(0, vol * mid * 5)
        
        # Imbalance mode: persistent shift
        if imb > 0.5:
            ask_vol_t *= 0.7
            bid_vol_t *= 1.3
        
        # Assemble
        volume_matrix[:mid_idx, t] = bid_vol_t
        volume_matrix[mid_idx:, t] = ask_vol_t
    return price_grid, time_grid, volume_matrix

# --- Metrics ---
def compute_imbalance(volume_matrix):
    mid_idx = N_PRICE // 2
    bid_sum = np.sum(volume_matrix[:mid_idx, :])
    ask_sum = np.sum(volume_matrix[mid_idx:, :])
    return (bid_sum - ask_sum) / (bid_sum + ask_sum + 1e-6)

def compute_liquidity_depth(volume_matrix):
    return np.mean(volume_matrix)

# --- Visualization ---
def plot_3d_surface(price_grid, time_grid, volume_matrix):
    # Neon coloring: bid blue, ask magenta
    mid_idx = N_PRICE // 2
    colorscale = []
    for i in range(N_PRICE):
        if i < mid_idx:
            colorscale.append([i/(N_PRICE-1), "#00f0ff"])  # Neon blue
        else:
            colorscale.append([i/(N_PRICE-1), "#ff00ea"])  # Neon magenta
    
    surface = go.Surface(
        x=price_grid,
        y=time_grid,
        z=volume_matrix.T,
        colorscale="Viridis",
        showscale=False,
        opacity=0.98,
        lighting=dict(ambient=0.8, diffuse=0.9, specular=0.5, roughness=0.3),
    )
    layout = go.Layout(
        autosize=True,
        width=1200,
        height=700,
        margin=dict(l=0, r=0, b=0, t=0),
        paper_bgcolor="#181825",
        plot_bgcolor="#181825",
        scene=dict(
            xaxis=dict(title="Price", showspikes=False, backgroundcolor="#181825", gridcolor="#222"),
            yaxis=dict(title="Time", showspikes=False, backgroundcolor="#181825", gridcolor="#222"),
            zaxis=dict(title="Volume", showspikes=False, backgroundcolor="#181825", gridcolor="#222"),
            camera=dict(eye=dict(x=1.7, y=1.7, z=1.7)),
        ),
    )
    fig = go.Figure(data=[surface], layout=layout)
    # Camera auto rotation
    fig.update_layout(
        scene_camera_eye=dict(x=1.7, y=1.7, z=1.7),
        updatemenus=[
            dict(
                type="buttons",
                showactive=False,
                buttons=[
                    dict(
                        label="Rotate",
                        method="animate",
                        args=[None, {"frame": {"duration": 50, "redraw": True}, "fromcurrent": True}]
                    )
                ],
                x=0.1,
                y=1.1,
            )
        ]
    )
    return fig

# --- Main App ---
st.title("3D Order Book Liquidity Simulator — Market Microstructure Lab")
st.markdown("""
<style>
body { background-color: #181825; }
[data-testid="stSidebar"] { background-color: #232336; }
[data-testid="stAppViewContainer"] { background-color: #181825; }
[data-testid="stHeader"] { background-color: #181825; }
[data-testid="stToolbar"] { background-color: #181825; }
</style>
""", unsafe_allow_html=True)

placeholder = st.empty()
st.success("Simulation complete.")

# Run simulation once and show interactive figure
price_grid, time_grid, volume_matrix = simulate_order_book(
    mid_price, volatility, imbalance_intensity, spoofing, flash_crash
)
fig = plot_3d_surface(price_grid, time_grid, volume_matrix)
imbalance_metric = compute_imbalance(volume_matrix)
liquidity_depth = compute_liquidity_depth(volume_matrix)
with placeholder.container():
    st.plotly_chart(fig, use_container_width=True)
    st.markdown(f"**Imbalance Metric:** {imbalance_metric:.3f}")
    st.markdown(f"**Liquidity Depth:** {liquidity_depth:.1f}")

st.info("Use mouse or touch to rotate, zoom, and explore the 3D surface interactively.")
