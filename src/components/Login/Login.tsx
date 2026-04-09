import { useAuth } from "../../auth/AuthContext";
import { Container, Button } from './styled';
import { LOGIN_BUTTON_TEXT, LOGOUT_BUTTON_TEXT } from './constants';

export function Login() {
    const { token, login, logout } = useAuth();
    return (
        <Container>
            {!token &&
                <Button onClick={login}>
                    {LOGIN_BUTTON_TEXT}
                </Button>}
            {token &&
                <Button onClick={logout}>
                    {LOGOUT_BUTTON_TEXT}
                </Button>}
        </Container>
    );
}