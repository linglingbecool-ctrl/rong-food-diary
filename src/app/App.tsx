import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "../components/layout/AppShell";
import { HomePage } from "../pages/HomePage";
import { MapPage } from "../pages/MapPage";
import { RestaurantDetailPage } from "../pages/RestaurantDetailPage";
import { RestaurantListPage } from "../pages/RestaurantListPage";
import { SettingsPage } from "../pages/SettingsPage";
import { StatsPage } from "../pages/StatsPage";
import { VisitCreatePage } from "../pages/VisitCreatePage";
import { VisitDetailPage } from "../pages/VisitDetailPage";
import { VisitEditPage } from "../pages/VisitEditPage";
import { WelcomePage } from "../pages/WelcomePage";
import { WishlistPage } from "../pages/WishlistPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route element={<AppShell />}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/visits/new" element={<VisitCreatePage />} />
        <Route path="/visits/:id" element={<VisitDetailPage />} />
        <Route path="/visits/:id/edit" element={<VisitEditPage />} />
        <Route path="/restaurants" element={<RestaurantListPage />} />
        <Route path="/restaurants/:id" element={<RestaurantDetailPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
