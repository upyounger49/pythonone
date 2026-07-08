import { useState } from "react";
import { apiFetch } from "../api/client";
import { TokenResponse, User } from "../types";

interface LoginPageProps {
  onLogin: (user: User) => void;
}

type TabType = "login" | "register";

function LoginPage({ onLogin }: LoginPageProps) {
  const [tab, setTab] = useState<TabType>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (tab === "register" && password !== confirmPassword) {
      setError("两次密码不一致");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = tab === "login" ? "/auth/login" : "/auth/register";
      const tokenResp = await apiFetch<TokenResponse>(endpoint, {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      localStorage.setItem("access_token", tokenResp.access_token);

      const user = await apiFetch<User>("/auth/me");
      onLogin(user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-pink-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-rose-600">心声</h1>
          <p className="text-gray-500 mt-2">Heart Whisper · 你的专属情感顾问</p>
        </div>

        <div className="flex mb-6 border-b border-gray-200">
          <button
            className={`flex-1 pb-3 text-sm font-medium transition-colors ${
              tab === "login"
                ? "text-rose-600 border-b-2 border-rose-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setTab("login")}
          >
            登录
          </button>
          <button
            className={`flex-1 pb-3 text-sm font-medium transition-colors ${
              tab === "register"
                ? "text-rose-600 border-b-2 border-rose-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setTab("register")}
          >
            注册
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              required
              minLength={2}
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              required
              minLength={6}
              autoComplete={tab === "login" ? "current-password" : "new-password"}
            />
          </div>

          {tab === "register" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                确认密码
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-rose-600 text-white py-2.5 rounded-lg font-medium hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "处理中..." : tab === "login" ? "登录" : "注册"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
