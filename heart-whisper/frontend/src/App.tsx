import { useEffect, useState } from "react";
import LoginPage from "./pages/LoginPage";
import ChatPage from "./pages/ChatPage";
import { User } from "./types";
import { apiFetch } from "./api/client";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }

    apiFetch<User>("/auth/me")
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("access_token");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <ChatPage user={user} onLogout={handleLogout} />;
}

export default App;
