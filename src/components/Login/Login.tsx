import { useAuth } from "../../auth/AuthContext";

export function Login() {
    const { token, login, logout } = useAuth();
    return (
        <div style={containerStyle}>
            {!token &&
                <button onClick={login} style={btnStyle}>
                    Login to Zooniverse
                </button>}
            {token &&
                <button onClick={logout} style={btnStyle}>
                    Logout of Zooniverse
                </button>}
        </div>
    );
}

const containerStyle: React.CSSProperties = { display: 'inline-block' };
const btnStyle: React.CSSProperties = {
    padding: '8px 16px',
    background: '#0f3460',
    border: '1px solid #e94560',
    borderRadius: 6,
    color: '#eee',
    cursor: 'pointer',
};