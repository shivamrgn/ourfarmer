import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocumentationPage } from "../components/modules/DocumentationPage";

describe("DocumentationPage — Farmer-Friendly Help & Learning Centre", () => {
  it("renders the redesigned Farmer Help & Learning Centre banner and title", () => {
    render(<DocumentationPage />);
    expect(screen.getByText("Farmer Help & Learning Centre")).toBeInTheDocument();
    expect(screen.getByText("How to Use FieldWise on Your Farm")).toBeInTheDocument();
  });

  it("renders all seven navigation tabs", () => {
    render(<DocumentationPage />);
    expect(screen.getByText("Welcome & Purpose")).toBeInTheDocument();
    expect(screen.getByText("How FieldWise Works")).toBeInTheDocument();
    expect(screen.getByText("Using Features")).toBeInTheDocument();
    expect(screen.getByText("Understanding Results")).toBeInTheDocument();
    expect(screen.getByText("Farming Knowledge")).toBeInTheDocument();
    expect(screen.getByText("Frequently Asked Questions")).toBeInTheDocument();
    expect(screen.getByText("Technical Reference")).toBeInTheDocument();
  });

  it("navigates to Section 2 (The Farmer Journey) and displays all 6 steps", () => {
    render(<DocumentationPage />);
    fireEvent.click(screen.getByText("How FieldWise Works"));
    expect(screen.getByText("2. The Complete Farmer Journey")).toBeInTheDocument();
    expect(screen.getByText("Create Your Account")).toBeInTheDocument();
    expect(screen.getByText("Set Up Your Farm")).toBeInTheDocument();
    expect(screen.getByText("Enter Soil Details")).toBeInTheDocument();
    expect(screen.getByText("Use Advisory Tools")).toBeInTheDocument();
    expect(screen.getByText("Understand Results")).toBeInTheDocument();
    expect(screen.getByText("Track, Review & Act")).toBeInTheDocument();
  });

  it("navigates to Section 3 (Using Features) and allows selecting features", () => {
    render(<DocumentationPage />);
    fireEvent.click(screen.getByText("Using Features"));
    expect(screen.getByText("3. Practical Guides for Every Feature")).toBeInTheDocument();

    // Verify My Farm is selected by default
    expect(screen.getByRole("heading", { name: /My Farm \(Farmer Profile\)/i })).toBeInTheDocument();

    // Select Crop Recommendation
    const cropRecBtn = screen.getByRole("button", { name: /Crop Recommendation Engine/i });
    fireEvent.click(cropRecBtn);
    expect(screen.getByRole("heading", { name: "Crop Recommendation Engine" })).toBeInTheDocument();
    expect(screen.getByText(/Analyzes 7 agronomic vectors/i)).toBeInTheDocument();
  });

  it("filters feature guides via search input", () => {
    render(<DocumentationPage />);
    const searchInput = screen.getByPlaceholderText(/Search topics/i);
    fireEvent.change(searchInput, { target: { value: "fertilizer" } });

    fireEvent.click(screen.getByText("Using Features"));
    expect(screen.getByText("Fertilizer Recommendation Calculator")).toBeInTheDocument();
  });

  it("navigates to Section 4 (Understanding Results) and explains scores and pH", () => {
    render(<DocumentationPage />);
    fireEvent.click(screen.getByText("Understanding Results"));
    expect(screen.getByText("4. How to Interpret Recommendations & Scores")).toBeInTheDocument();
    expect(screen.getByText(/Crop Suitability Score/i)).toBeInTheDocument();
    expect(screen.getByText(/Understanding Soil pH/i)).toBeInTheDocument();
    expect(screen.getByText(/Disease Detection Confidence & Severity Levels/i)).toBeInTheDocument();
  });

  it("navigates to Section 5 (Basic Farming Knowledge) and explains soil and NPK", () => {
    render(<DocumentationPage />);
    fireEvent.click(screen.getByText("Farming Knowledge"));
    expect(screen.getByText("5. Essential Agricultural Concepts for Every Farmer")).toBeInTheDocument();
    expect(screen.getByText(/How to Take a Soil Sample Correctly/i)).toBeInTheDocument();
    expect(screen.getByText(/The Big Three: Nitrogen, Phosphorus, Potassium/i)).toBeInTheDocument();
    expect(screen.getByText(/Understanding the 3 Crop Seasons/i)).toBeInTheDocument();
  });

  it("navigates to Section 6 (FAQs) and answers common questions", () => {
    render(<DocumentationPage />);
    fireEvent.click(screen.getByText("Frequently Asked Questions"));
    expect(screen.getByText("6. Frequently Asked Questions")).toBeInTheDocument();
    expect(screen.getByText(/Can I use FieldWise if I do not have a recent Soil Health Card/i)).toBeInTheDocument();
    expect(screen.getByText(/Are the crop recommendations and fertilizer amounts guaranteed to give high yields/i)).toBeInTheDocument();
  });

  it("navigates to Section 7 (Technical Reference) preserving developer documentation pointer", () => {
    render(<DocumentationPage />);
    fireEvent.click(screen.getByText("Technical Reference"));
    expect(screen.getByText("7. Technical Architecture & Developer Reference")).toBeInTheDocument();
    expect(screen.getByText(/FieldWise_main\/docs\/TECHNICAL_DOCUMENTATION.md/i)).toBeInTheDocument();
    expect(screen.getByText("React 18 + Vite + Tailwind")).toBeInTheDocument();
    expect(screen.getByText("Node.js Express + SQLite")).toBeInTheDocument();
  });

  it("triggers onNavigate callback when clicking navigation shortcuts", () => {
    const handleNavigate = vi.fn();
    render(<DocumentationPage onNavigate={handleNavigate} />);

    const dashboardBtn = screen.getByRole("button", { name: /Back to Dashboard/i });
    fireEvent.click(dashboardBtn);
    expect(handleNavigate).toHaveBeenCalledWith("home");

    const profileBtns = screen.getAllByRole("button", { name: /My Farm Profile/i });
    fireEvent.click(profileBtns[0]);
    expect(handleNavigate).toHaveBeenCalledWith("profile");
  });
});
