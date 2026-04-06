import styled from 'styled-components';
import { theme } from '../../theme/zooniverseTheme';
import { useAuth } from "../../auth/AuthContext";

const Container = styled.div`
  display: inline-block;
`;

const Button = styled.button`
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  background: ${theme.colors.secondary};
  border: 1px solid ${theme.colors.primary};
  border-radius: ${theme.borders.radius.base};
  color: ${theme.colors.text.inverse};
  cursor: pointer;
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  transition: all ${theme.transitions.base};

  &:hover {
    background: ${theme.colors.primary};
    color: ${theme.colors.secondary};
  }

  &:active {
    transform: scale(0.95);
  }
`;

/**
 * Login component for Zooniverse authentication.
 * Displays login button when no token, logout button when authenticated.
 */
export function Login() {
    const { token, login, logout } = useAuth();
    return (
        <Container>
            {!token &&
                <Button onClick={login}>
                    Login to Zooniverse
                </Button>}
            {token &&
                <Button onClick={logout}>
                    Logout of Zooniverse
                </Button>}
        </Container>
    );
}