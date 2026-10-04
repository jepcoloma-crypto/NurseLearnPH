import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { LogIn, AlertCircle } from "lucide-react";
import Logo from "@/components/Logo";

const schema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    try {
      await login(data.username, data.password);
      toast.success("Logged in successfully");
      navigate("/");
    } catch (err: unknown) {
      let msg = "Login failed. Please try again.";
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as {
          response?: {
            status?: number;
            data?: { message?: string; error?: { message?: string } };
          };
        };
        const serverMsg =
          axiosErr.response?.data?.error?.message || axiosErr.response?.data?.message;
        if (serverMsg) {
          msg = serverMsg;
        } else if (axiosErr.response?.status === 401) {
          msg = "Incorrect username or password.";
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-100 via-[#f3f8f7] to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={56} className="mb-3" />
          <h1 className="text-3xl font-bold text-primary-900">NurseLearn PH</h1>
          <p className="text-primary-800/60 mt-2">Nursing Competency & Learning Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl ring-1 ring-primary-100/80 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary-600 via-primary-400 to-primary-200" />
          <div className="p-8">
          <div className="flex items-center gap-2 mb-6">
            <span className="p-2 rounded-lg bg-primary-50 text-primary-700"><LogIn size={20} /></span>
            <h2 className="text-xl font-semibold">Sign In</h2>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                {...register("username")}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="Enter your username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                {...register("password")}
                type="password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary-600 font-medium hover:underline">
              Sign up
            </Link>
          </p>
          </div>
        </div>

        <p className="text-center text-xs text-primary-800/50 mt-6">
          Contact your administrator for login credentials.
        </p>
      </div>
    </div>
  );
}
