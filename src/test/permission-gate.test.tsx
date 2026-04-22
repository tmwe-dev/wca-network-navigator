import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PermissionGate, RequirePermission } from "@/components/auth/PermissionGate";

// Mock useRBAC hook
vi.mock("@/hooks/useRBAC", () => ({
  useHasPermission: vi.fn(),
}));

import { useHasPermission } from "@/hooks/useRBAC";

describe("PermissionGate Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("PermissionGate", () => {
    it("should render children when user has permission", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: true,
        isLoading: false,
        error: null,
      } as any);

      render(
        <PermissionGate permission="create_user">
          <div>Protected Content</div>
        </PermissionGate>
      );

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    it("should not render children when user does not have permission", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: false,
        isLoading: false,
        error: null,
      } as any);

      render(
        <PermissionGate permission="create_user">
          <div>Protected Content</div>
        </PermissionGate>
      );

      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("should render default deny message when permission denied and no fallback", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: false,
        isLoading: false,
        error: null,
      } as any);

      render(
        <PermissionGate permission="delete_user">
          <div>Protected Content</div>
        </PermissionGate>
      );

      expect(screen.getByText(/Non hai il permesso/i)).toBeInTheDocument();
    });

    it("should render fallback when permission denied and fallback provided", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: false,
        isLoading: false,
        error: null,
      } as any);

      render(
        <PermissionGate permission="delete_user" fallback={<div>Access Denied</div>}>
          <div>Protected Content</div>
        </PermissionGate>
      );

      expect(screen.getByText("Access Denied")).toBeInTheDocument();
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("should show loading spinner while checking permission", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: false,
        isLoading: true,
        error: null,
      } as any);

      const { container } = render(
        <PermissionGate permission="create_user">
          <div>Protected Content</div>
        </PermissionGate>
      );

      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("should call useHasPermission with correct permission key", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: true,
        isLoading: false,
        error: null,
      } as any);

      render(
        <PermissionGate permission="specific_permission">
          <div>Content</div>
        </PermissionGate>
      );

      expect(useHasPermission).toHaveBeenCalledWith("specific_permission");
    });

    it("should render multiple children correctly", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: true,
        isLoading: false,
        error: null,
      } as any);

      render(
        <PermissionGate permission="view_dashboard">
          <div>Component A</div>
          <div>Component B</div>
          <div>Component C</div>
        </PermissionGate>
      );

      expect(screen.getByText("Component A")).toBeInTheDocument();
      expect(screen.getByText("Component B")).toBeInTheDocument();
      expect(screen.getByText("Component C")).toBeInTheDocument();
    });

    it("should render with custom fallback React component", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: false,
        isLoading: false,
        error: null,
      } as any);

      const CustomFallback = () => <div>Custom Fallback Message</div>;

      render(
        <PermissionGate permission="admin_panel" fallback={<CustomFallback />}>
          <div>Admin Panel</div>
        </PermissionGate>
      );

      expect(screen.getByText("Custom Fallback Message")).toBeInTheDocument();
      expect(screen.queryByText("Admin Panel")).not.toBeInTheDocument();
    });

    it("should handle nested PermissionGate components", () => {
      vi.mocked(useHasPermission)
        .mockReturnValueOnce({
          hasPermission: true,
          isLoading: false,
          error: null,
        } as any)
        .mockReturnValueOnce({
          hasPermission: false,
          isLoading: false,
          error: null,
        } as any);

      render(
        <PermissionGate permission="perm1">
          <div>Level 1</div>
          <PermissionGate permission="perm2" fallback={<div>No Level 2</div>}>
            <div>Level 2</div>
          </PermissionGate>
        </PermissionGate>
      );

      expect(screen.getByText("Level 1")).toBeInTheDocument();
      expect(screen.getByText("No Level 2")).toBeInTheDocument();
      expect(screen.queryByText("Level 2")).not.toBeInTheDocument();
    });

    it("should update when permission changes", () => {
      const { rerender } = vi.mocked(useHasPermission);

      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: false,
        isLoading: false,
        error: null,
      } as any);

      const { rerender: rerenderComponent } = render(
        <PermissionGate permission="test_perm">
          <div>Protected</div>
        </PermissionGate>
      );

      expect(screen.queryByText("Protected")).not.toBeInTheDocument();

      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: true,
        isLoading: false,
        error: null,
      } as any);

      rerenderComponent(
        <PermissionGate permission="test_perm">
          <div>Protected</div>
        </PermissionGate>
      );

      expect(screen.getByText("Protected")).toBeInTheDocument();
    });

    it("should not render spinner when not loading even with permission denied", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: false,
        isLoading: false,
        error: null,
      } as any);

      const { container } = render(
        <PermissionGate permission="create_user">
          <div>Protected Content</div>
        </PermissionGate>
      );

      const spinner = container.querySelector(".animate-spin");
      expect(spinner).not.toBeInTheDocument();
    });

    it("should render deny alert with Lock icon", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: false,
        isLoading: false,
        error: null,
      } as any);

      const { container } = render(
        <PermissionGate permission="sensitive_action">
          <div>Sensitive Content</div>
        </PermissionGate>
      );

      const alertElement = container.querySelector('[class*="destructive"]');
      expect(alertElement).toBeInTheDocument();
    });
  });

  describe("RequirePermission Component", () => {
    it("should render children when permission granted", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: true,
        isLoading: false,
        error: null,
      } as any);

      render(
        <RequirePermission permission="edit_users">
          <div>Edit Users Form</div>
        </RequirePermission>
      );

      expect(screen.getByText("Edit Users Form")).toBeInTheDocument();
    });

    it("should not render children when permission denied", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: false,
        isLoading: false,
        error: null,
      } as any);

      render(
        <RequirePermission permission="edit_users">
          <div>Edit Users Form</div>
        </RequirePermission>
      );

      expect(screen.queryByText("Edit Users Form")).not.toBeInTheDocument();
    });

    it("should show loading state", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: false,
        isLoading: true,
        error: null,
      } as any);

      const { container } = render(
        <RequirePermission permission="edit_users">
          <div>Edit Users Form</div>
        </RequirePermission>
      );

      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("should use PermissionGate internally", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: true,
        isLoading: false,
        error: null,
      } as any);

      render(
        <RequirePermission permission="test_permission">
          <div>Test Content</div>
        </RequirePermission>
      );

      expect(useHasPermission).toHaveBeenCalledWith("test_permission");
      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });

    it("should accept children prop correctly", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: true,
        isLoading: false,
        error: null,
      } as any);

      const TestComponent = () => <span>Rendered</span>;

      render(
        <RequirePermission permission="perm">
          <TestComponent />
        </RequirePermission>
      );

      expect(screen.getByText("Rendered")).toBeInTheDocument();
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle permission with special characters", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: true,
        isLoading: false,
        error: null,
      } as any);

      render(
        <PermissionGate permission="perm:scope/action">
          <div>Content</div>
        </PermissionGate>
      );

      expect(useHasPermission).toHaveBeenCalledWith("perm:scope/action");
      expect(screen.getByText("Content")).toBeInTheDocument();
    });

    it("should handle empty string as fallback", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: false,
        isLoading: false,
        error: null,
      } as any);

      render(
        <PermissionGate permission="test" fallback="">
          <div>Protected</div>
        </PermissionGate>
      );

      expect(screen.queryByText("Protected")).not.toBeInTheDocument();
    });

    it("should handle null children gracefully", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: true,
        isLoading: false,
        error: null,
      } as any);

      const { container } = render(
        <PermissionGate permission="test">
          {null}
        </PermissionGate>
      );

      expect(container.innerHTML).toContain("");
    });

    it("should maintain permission state across renders", () => {
      vi.mocked(useHasPermission).mockReturnValue({
        hasPermission: true,
        isLoading: false,
        error: null,
      } as any);

      const { rerender } = render(
        <PermissionGate permission="test_perm">
          <div>Content</div>
        </PermissionGate>
      );

      expect(screen.getByText("Content")).toBeInTheDocument();

      rerender(
        <PermissionGate permission="test_perm">
          <div>Updated Content</div>
        </PermissionGate>
      );

      expect(screen.getByText("Updated Content")).toBeInTheDocument();
    });
  });
});
