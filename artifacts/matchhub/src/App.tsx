import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Layout } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";

import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import CreateParty from "@/pages/CreateParty";
import Party from "@/pages/Party";
import NewMatch from "@/pages/NewMatch";
import MatchDetail from "@/pages/MatchDetail";
import SubmitResult from "@/pages/SubmitResult";
import History from "@/pages/History";
import Rankings from "@/pages/Rankings";
import Profile from "@/pages/Profile";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      <Route>
        <Layout>
          <Switch>
            <Route path="/">
              <ProtectedRoute><Home /></ProtectedRoute>
            </Route>
            <Route path="/party/new">
              <ProtectedRoute><CreateParty /></ProtectedRoute>
            </Route>
            <Route path="/parties/:partyId/new-match">
              <ProtectedRoute><NewMatch /></ProtectedRoute>
            </Route>
            <Route path="/parties/:partyId">
              <ProtectedRoute><Party /></ProtectedRoute>
            </Route>
            <Route path="/matches/:matchId">
              <ProtectedRoute><MatchDetail /></ProtectedRoute>
            </Route>
            <Route path="/matches/:matchId/result">
              <ProtectedRoute><SubmitResult /></ProtectedRoute>
            </Route>
            <Route path="/history">
              <ProtectedRoute><History /></ProtectedRoute>
            </Route>
            <Route path="/rankings">
              <ProtectedRoute><Rankings /></ProtectedRoute>
            </Route>
            <Route path="/profile">
              <ProtectedRoute><Profile /></ProtectedRoute>
            </Route>
            <Route path="/profile/:userId">
              <ProtectedRoute><Profile /></ProtectedRoute>
            </Route>
            <Route path="/admin">
              <AdminRoute><Admin /></AdminRoute>
            </Route>
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
