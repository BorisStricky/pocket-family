// src/pages/landing_page.tsx
// Landing page with call-to-action buttons

import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Box, Container, Typography, Button, Stack } from "@mui/material";
import { useAuth } from "@/features/auth/hooks/useAuth";

export default function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate("/app");
    } else {
      navigate("/signup");
    }
  };

  const handleLogin = () => {
    navigate("/login");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Hero Section */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          background: "linear-gradient(135deg, #044218 0%, #032e11 100%)",
          color: "white",
          py: 8,
        }}
      >
        <Container maxWidth="md">
          <Box sx={{ textAlign: "center" }}>
            <Typography
              variant="h2"
              component="h1"
              gutterBottom
              sx={{ fontWeight: "bold" }}
            >
              {t("landing.heroTitle")}
            </Typography>
            <Typography variant="h5" component="p" sx={{ mb: 4, opacity: 0.9 }}>
              {t("landing.heroTagline")}
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              justifyContent="center"
            >
              <Button
                variant="contained"
                size="large"
                onClick={handleGetStarted}
                sx={{
                  bgcolor: "white",
                  color: "#044218",
                  "&:hover": { bgcolor: "#E7FEEE" },
                  px: 4,
                  py: 1.5,
                }}
              >
                {isAuthenticated ? t("landing.goToDashboard") : t("landing.getStarted")}
              </Button>
              {!isAuthenticated && (
                <Button
                  variant="outlined"
                  size="large"
                  onClick={handleLogin}
                  sx={{
                    borderColor: "white",
                    color: "white",
                    "&:hover": {
                      borderColor: "#f5f5f5",
                      bgcolor: "rgba(255, 255, 255, 0.1)",
                    },
                    px: 4,
                    py: 1.5,
                  }}
                >
                  {t("landing.logIn")}
                </Button>
              )}
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Features Section */}
      <Box sx={{ py: 8, bgcolor: "background.default" }}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            component="h2"
            gutterBottom
            sx={{ textAlign: "center", mb: 6 }}
          >
            {t("landing.featuresTitle")}
          </Typography>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={4}
            justifyContent="center"
          >
            <Box sx={{ flex: 1, textAlign: "center" }}>
              <Typography variant="h5" gutterBottom>
                {t("landing.trackExpensesTitle")}
              </Typography>
              <Typography color="text.secondary">
                {t("landing.trackExpensesDesc")}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, textAlign: "center" }}>
              <Typography variant="h5" gutterBottom>
                {t("landing.budgetTitle")}
              </Typography>
              <Typography color="text.secondary">
                {t("landing.budgetDesc")}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, textAlign: "center" }}>
              <Typography variant="h5" gutterBottom>
                {t("landing.reportsTitle")}
              </Typography>
              <Typography color="text.secondary">
                {t("landing.reportsDesc")}
              </Typography>
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 3,
          bgcolor: "#333",
          color: "white",
          textAlign: "center",
        }}
      >
        <Typography variant="body2">
          {t("landing.footer")}
        </Typography>
      </Box>
    </Box>
  );
}
