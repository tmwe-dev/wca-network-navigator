/**
 * Token Budget Enforcement Tests
 * Pure logic tests for token budget calculations, thresholds, and percentage calculations
 */
import { describe, it, expect } from "vitest";

// ─── Token Formatting ────────────────────────────────────

/**
 * Format token count to human-readable string
 */
function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}

// ─── Budget Threshold Checking ───────────────────────

interface TokenBudget {
  daily: number;
  monthly: number;
}

interface TokenUsage {
  today: number;
  month: number;
}

function getDailyBudgetStatus(usage: number, budget: number): "under" | "near" | "over" {
  const percentage = (usage / budget) * 100;
  if (percentage >= 100) return "over";
  if (percentage >= 85) return "near";
  return "under";
}

function getMonthlyBudgetStatus(usage: number, budget: number): "under" | "near" | "over" {
  const percentage = (usage / budget) * 100;
  if (percentage >= 100) return "over";
  if (percentage >= 85) return "near";
  return "under";
}

function calculatePercentage(used: number, budget: number): number {
  return budget > 0 ? Math.round((used / budget) * 100) : 0;
}

// ─── Tests ──────────────────────────────────────────────

describe("Token Budget Enforcement", () => {
  // ─── Token Formatting ────────────────────────────────

  describe("Format Token Counts", () => {
    it("should format small token counts as-is", () => {
      expect(formatTokenCount(42)).toBe("42");
      expect(formatTokenCount(500)).toBe("500");
      expect(formatTokenCount(999)).toBe("999");
    });

    it("should format thousands with K suffix", () => {
      expect(formatTokenCount(1000)).toBe("1.0K");
      expect(formatTokenCount(1500)).toBe("1.5K");
      expect(formatTokenCount(10000)).toBe("10.0K");
      expect(formatTokenCount(50000)).toBe("50.0K");
      expect(formatTokenCount(999999)).toBe("1000.0K");
    });

    it("should format millions with M suffix", () => {
      expect(formatTokenCount(1000000)).toBe("1.0M");
      expect(formatTokenCount(2500000)).toBe("2.5M");
      expect(formatTokenCount(10000000)).toBe("10.0M");
    });

    it("should handle zero and edge cases", () => {
      expect(formatTokenCount(0)).toBe("0");
      expect(formatTokenCount(1)).toBe("1");
    });
  });

  // ─── Daily Budget Thresholds ─────────────────────────

  describe("Daily Budget Thresholds", () => {
    it("should be under limit when usage is low", () => {
      const budget = 100000;
      const usage = 30000;
      expect(getDailyBudgetStatus(usage, budget)).toBe("under");
    });

    it("should be under limit at 50% usage", () => {
      const budget = 100000;
      const usage = 50000;
      expect(getDailyBudgetStatus(usage, budget)).toBe("under");
    });

    it("should be under limit at 84% usage", () => {
      const budget = 100000;
      const usage = 84000;
      expect(getDailyBudgetStatus(usage, budget)).toBe("under");
    });

    it("should be near limit at 85% usage", () => {
      const budget = 100000;
      const usage = 85000;
      expect(getDailyBudgetStatus(usage, budget)).toBe("near");
    });

    it("should be near limit at 90% usage", () => {
      const budget = 100000;
      const usage = 90000;
      expect(getDailyBudgetStatus(usage, budget)).toBe("near");
    });

    it("should be near limit at 99% usage", () => {
      const budget = 100000;
      const usage = 99000;
      expect(getDailyBudgetStatus(usage, budget)).toBe("near");
    });

    it("should be over limit at 100% usage", () => {
      const budget = 100000;
      const usage = 100000;
      expect(getDailyBudgetStatus(usage, budget)).toBe("over");
    });

    it("should be over limit when exceeding budget", () => {
      const budget = 100000;
      const usage = 150000;
      expect(getDailyBudgetStatus(usage, budget)).toBe("over");
    });

    it("should handle fractional percentages", () => {
      const budget = 1000;
      const usage = 850; // 85%
      expect(getDailyBudgetStatus(usage, budget)).toBe("near");
    });
  });

  // ─── Monthly Budget Thresholds ────────────────────────

  describe("Monthly Budget Thresholds", () => {
    it("should be under limit at 50% usage", () => {
      const budget = 1000000;
      const usage = 500000;
      expect(getMonthlyBudgetStatus(usage, budget)).toBe("under");
    });

    it("should be near limit at 85% usage", () => {
      const budget = 1000000;
      const usage = 850000;
      expect(getMonthlyBudgetStatus(usage, budget)).toBe("near");
    });

    it("should be over limit when exceeding budget", () => {
      const budget = 1000000;
      const usage = 1500000;
      expect(getMonthlyBudgetStatus(usage, budget)).toBe("over");
    });

    it("should use same threshold logic for daily and monthly", () => {
      // Both should use 85% as threshold
      const dailyStatus = getDailyBudgetStatus(85000, 100000);
      const monthlyStatus = getMonthlyBudgetStatus(850000, 1000000);
      expect(dailyStatus).toBe(monthlyStatus);
      expect(dailyStatus).toBe("near");
    });
  });

  // ─── Percentage Calculations ────────────────────────

  describe("Percentage Calculations", () => {
    it("should calculate 0% when no usage", () => {
      expect(calculatePercentage(0, 100000)).toBe(0);
    });

    it("should calculate 50% correctly", () => {
      expect(calculatePercentage(50000, 100000)).toBe(50);
    });

    it("should calculate 85% correctly", () => {
      expect(calculatePercentage(85000, 100000)).toBe(85);
    });

    it("should calculate 100% at budget limit", () => {
      expect(calculatePercentage(100000, 100000)).toBe(100);
    });

    it("should calculate over 100% when exceeding", () => {
      expect(calculatePercentage(150000, 100000)).toBe(150);
    });

    it("should round percentages correctly", () => {
      expect(calculatePercentage(33333, 100000)).toBe(33);
      expect(calculatePercentage(33666, 100000)).toBe(34);
      expect(calculatePercentage(85555, 100000)).toBe(86);
    });

    it("should handle zero budget gracefully", () => {
      expect(calculatePercentage(100, 0)).toBe(0);
    });

    it("should handle very small percentages", () => {
      expect(calculatePercentage(1, 100000)).toBe(0);
      expect(calculatePercentage(100, 1000000)).toBe(0);
      expect(calculatePercentage(500, 1000000)).toBe(0);
      expect(calculatePercentage(501, 1000000)).toBe(1);
    });

    it("should handle very large numbers", () => {
      expect(calculatePercentage(500000000, 1000000000)).toBe(50);
      expect(calculatePercentage(850000000, 1000000000)).toBe(85);
    });
  });

  // ─── Daily vs Monthly Limits ────────────────────────

  describe("Daily vs Monthly Limits", () => {
    it("should allow same daily budget if within monthly", () => {
      const dailyBudget = 50000;
      const monthlyBudget = 1000000;

      // Using full daily budget 20 times should be within monthly
      const totalUsed = dailyBudget * 20;
      expect(totalUsed).toBe(1000000);
      expect(getDailyBudgetStatus(dailyBudget, dailyBudget)).toBe("over");
      expect(getMonthlyBudgetStatus(totalUsed, monthlyBudget)).toBe("over");
    });

    it("should enforce both daily and monthly limits independently", () => {
      const dailyBudget = 100000;
      const monthlyBudget = 1000000;

      const dailyUsage = 85000; // 85% of daily
      const monthlyUsage = 500000; // 50% of monthly

      expect(getDailyBudgetStatus(dailyUsage, dailyBudget)).toBe("near");
      expect(getMonthlyBudgetStatus(monthlyUsage, monthlyBudget)).toBe("under");
    });

    it("should warn about daily limit even if monthly is safe", () => {
      const dailyBudget = 50000;
      const monthlyBudget = 1000000;

      const dailyUsage = 45000; // 90% of daily
      const monthlyUsage = 100000; // 10% of monthly

      expect(getDailyBudgetStatus(dailyUsage, dailyBudget)).toBe("near");
      expect(getMonthlyBudgetStatus(monthlyUsage, monthlyBudget)).toBe("under");
    });

    it("should warn about monthly limit even if daily is safe", () => {
      const dailyBudget = 100000;
      const monthlyBudget = 500000;

      const dailyUsage = 50000; // 50% of daily
      const monthlyUsage = 425000; // 85% of monthly

      expect(getDailyBudgetStatus(dailyUsage, dailyBudget)).toBe("under");
      expect(getMonthlyBudgetStatus(monthlyUsage, monthlyBudget)).toBe("near");
    });
  });

  // ─── Practical Scenarios ─────────────────────────────

  describe("Practical Budget Scenarios", () => {
    it("should handle typical user daily usage", () => {
      const dailyBudget = 100000;
      const dailyUsage = 45000;

      const percentage = calculatePercentage(dailyUsage, dailyBudget);
      const status = getDailyBudgetStatus(dailyUsage, dailyBudget);

      expect(percentage).toBe(45);
      expect(status).toBe("under");
    });

    it("should warn when approaching daily limit", () => {
      const dailyBudget = 100000;
      const dailyUsage = 87000;

      const percentage = calculatePercentage(dailyUsage, dailyBudget);
      const status = getDailyBudgetStatus(dailyUsage, dailyBudget);

      expect(percentage).toBe(87);
      expect(status).toBe("near");
    });

    it("should block when exceeding daily limit", () => {
      const dailyBudget = 100000;
      const dailyUsage = 105000;

      const percentage = calculatePercentage(dailyUsage, dailyBudget);
      const status = getDailyBudgetStatus(dailyUsage, dailyBudget);

      expect(percentage).toBe(105);
      expect(status).toBe("over");
    });

    it("should track monthly accumulation", () => {
      const monthlyBudget = 1000000;
      let monthlyUsage = 0;

      // Simulate 25 days of usage
      for (let day = 1; day <= 25; day++) {
        monthlyUsage += 35000; // ~35K per day
      }

      const percentage = calculatePercentage(monthlyUsage, monthlyBudget);
      const status = getMonthlyBudgetStatus(monthlyUsage, monthlyBudget);

      expect(monthlyUsage).toBe(875000);
      expect(percentage).toBe(88);
      expect(status).toBe("near");
    });

    it("should handle reset at month boundary", () => {
      const monthlyBudget = 1000000;
      const monthlyUsage = 950000; // Near limit

      // At month boundary, reset to new month
      const newMonthUsage = 0;

      expect(getMonthlyBudgetStatus(monthlyUsage, monthlyBudget)).toBe("near");
      expect(getMonthlyBudgetStatus(newMonthUsage, monthlyBudget)).toBe("under");
    });

    it("should format budget displays correctly", () => {
      const dailyBudget = 100000;
      const monthlyBudget = 1000000;
      const dailyUsage = 85000;
      const monthlyUsage = 500000;

      expect(formatTokenCount(dailyBudget)).toBe("100.0K");
      expect(formatTokenCount(monthlyBudget)).toBe("1.0M");
      expect(formatTokenCount(dailyUsage)).toBe("85.0K");
      expect(formatTokenCount(monthlyUsage)).toBe("500.0K");
    });
  });

  // ─── Remaining Budget Calculations ────────────────

  describe("Remaining Budget", () => {
    it("should calculate remaining budget correctly", () => {
      const budget = 100000;
      const used = 60000;
      const remaining = budget - used;
      expect(remaining).toBe(40000);
    });

    it("should show negative remaining when over budget", () => {
      const budget = 100000;
      const used = 150000;
      const remaining = budget - used;
      expect(remaining).toBe(-50000);
    });

    it("should format remaining budget for display", () => {
      const budget = 100000;
      const used = 85000;
      const remaining = budget - used;
      expect(formatTokenCount(remaining)).toBe("15.0K");
    });

    it("should calculate days remaining with average usage", () => {
      const dailyBudget = 100000;
      const monthlyBudget = 1000000;
      const daysElapsed = 10;
      const tokensUsed = 400000;

      const avgDaily = tokensUsed / daysElapsed; // 40k per day
      const remainingMonth = monthlyBudget - tokensUsed; // 600k
      const daysRemaining = Math.floor(remainingMonth / avgDaily); // ~15 days

      expect(avgDaily).toBe(40000);
      expect(daysRemaining).toBe(15);
    });
  });

  // ─── Edge Cases ──────────────────────────────────────

  describe("Edge Cases", () => {
    it("should handle zero budgets", () => {
      expect(getDailyBudgetStatus(0, 0)).toBe("under");
      expect(calculatePercentage(0, 0)).toBe(0);
    });

    it("should handle very high usage", () => {
      const budget = 100000;
      const usage = 1000000;
      expect(getDailyBudgetStatus(usage, budget)).toBe("over");
      expect(calculatePercentage(usage, budget)).toBe(1000);
    });

    it("should handle fractional tokens", () => {
      expect(calculatePercentage(33.33, 100)).toBe(33);
      expect(calculatePercentage(50.5, 100)).toBe(51);
    });

    it("should be consistent across calls", () => {
      const budget = 100000;
      const usage = 85000;

      const status1 = getDailyBudgetStatus(usage, budget);
      const status2 = getDailyBudgetStatus(usage, budget);
      expect(status1).toBe(status2);

      const perc1 = calculatePercentage(usage, budget);
      const perc2 = calculatePercentage(usage, budget);
      expect(perc1).toBe(perc2);
    });
  });

  // ─── Integration ────────────────────────────────────

  describe("Budget Integration", () => {
    it("should track complete daily cycle", () => {
      const dailyBudget = 100000;
      let dailyUsage = 0;

      const transactions = [20000, 30000, 25000, 20000]; // 4 transactions

      for (const tokens of transactions) {
        dailyUsage += tokens;
        const status = getDailyBudgetStatus(dailyUsage, dailyBudget);
        expect(status).not.toBe("over");
      }

      expect(dailyUsage).toBe(95000);
      expect(getDailyBudgetStatus(dailyUsage, dailyBudget)).toBe("near");
    });

    it("should prevent overspending within same cycle", () => {
      const dailyBudget = 100000;
      let dailyUsage = 95000;

      // Trying to use more than remaining
      const nextRequest = 10000;
      const wouldExceed = dailyUsage + nextRequest > dailyBudget;

      expect(wouldExceed).toBe(true);
      // Should reject this request
    });

    it("should support tiered quotas", () => {
      const quotas = {
        free: { daily: 10000, monthly: 100000 },
        pro: { daily: 100000, monthly: 1000000 },
        enterprise: { daily: 1000000, monthly: 10000000 },
      };

      const freeStatus = getDailyBudgetStatus(9000, quotas.free.daily);
      const proStatus = getDailyBudgetStatus(90000, quotas.pro.daily);
      const enterpriseStatus = getDailyBudgetStatus(900000, quotas.enterprise.daily);

      expect(freeStatus).toBe("near");
      expect(proStatus).toBe("near");
      expect(enterpriseStatus).toBe("near");
    });
  });
});
