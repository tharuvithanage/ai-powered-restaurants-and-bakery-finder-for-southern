import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/Login.jsx";
import RegisterPage from "./pages/Register.jsx";
import "./pages/css/Login.css";
import Home from "./pages/Home";
import RestaurantDetails from "./pages/RestaurantDetails";
import Profile from "./pages/Profile.jsx";
import Favorites from "./pages/Favorites.jsx";
import ProtectedRoute from "./routes/ProtectedRoute";
import AdminRoute from "./routes/AdminRoute.jsx";
import AdminPage from "./pages/Admin.jsx";
import OwnerRoute from "./routes/OwnerRoute.jsx";
import OwnerPage from "./pages/Owner.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/Home" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/restaurant/:id" element={<RestaurantDetails />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/favorites" element={<Favorites />} />
        </Route>
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route element={<OwnerRoute />}>
          <Route path="/owner" element={<OwnerPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
