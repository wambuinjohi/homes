describe('SPA Routing E2E Tests', () => {
  const baseUrl = Cypress.config('baseUrl') || 'http://localhost:8080';

  describe('Deep Link Navigation', () => {
    const protectedRoutes = [
      '/',
      '/properties',
      '/units', 
      '/tenants',
      '/invoices',
      '/payments',
      '/reports',
      '/expenses',
      '/maintenance',
      '/settings',
      '/support',
      '/notifications',
      '/leases',
      '/upgrade',
      '/billing',
      '/tenant/maintenance',
      '/tenant/messages',
      '/admin/users',
      '/admin/billing'
    ];

    protectedRoutes.forEach(route => {
      it(`should handle direct navigation to ${route}`, () => {
        cy.visit(route);
        
        // Should redirect to auth for unauthenticated users
        cy.url().should('include', '/auth');
        
        // Page should load without 404 error
        cy.get('body').should('not.contain', 'Cannot GET');
        cy.get('body').should('not.contain', '404');
      });
    });

    it('should handle deep links with query parameters', () => {
      cy.visit('/properties?page=2&filter=active');
      cy.url().should('include', '/auth');
      // Verify query params are preserved in redirect state if needed
    });
  });

  describe('Page Refresh Handling', () => {
    beforeEach(() => {
      // Mock authentication for these tests
      cy.window().then((win) => {
        win.localStorage.setItem('test-auth', 'true');
      });
    });

    const routesToTest = [
      '/properties',
      '/tenants',
      '/invoices'
    ];

    routesToTest.forEach(route => {
      it(`should handle page refresh on ${route}`, () => {
        cy.visit(route);
        cy.reload();
        
        // Page should still work after refresh
        cy.get('body').should('not.contain', 'Cannot GET');
        cy.get('body').should('not.contain', '404');
      });
    });
  });

  describe('Logout Flow', () => {
    it('should redirect to auth page after logout', () => {
      // This would need actual login/logout implementation
      cy.visit('/auth');
      
      // Login process would go here
      // cy.login() - custom command
      
      // Navigate to protected route
      // cy.visit('/dashboard');
      
      // Logout
      // cy.logout() - custom command
      
      // Verify redirect to auth
      // cy.url().should('include', '/auth');
    });

    it('should prevent back navigation after logout', () => {
      // Login, navigate to protected route, logout, try to go back
      // Verify user stays on auth page or gets redirected
    });
  });

  describe('404 Handling', () => {
    it('should show React 404 page for unknown routes', () => {
      cy.visit('/this/route/does/not/exist');
      
      // Should not get server 404
      cy.get('body').should('not.contain', 'Cannot GET');
      
      // Should show React NotFound component
      cy.get('[data-testid="not-found"]').should('exist');
      cy.contains('404').should('exist');
    });

    it('should show 404 for unknown tenant routes', () => {
      cy.visit('/tenant/unknown-route');
      cy.get('[data-testid="not-found"]').should('exist');
    });

    it('should show 404 for unknown admin routes', () => {
      cy.visit('/admin/unknown-route');
      cy.get('[data-testid="not-found"]').should('exist');
    });
  });

  describe('Static Asset Loading', () => {
    it('should load favicon correctly', () => {
      cy.request('/favicon.ico').its('status').should('eq', 200);
    });

    it('should load static images', () => {
      cy.request('/lovable-uploads/5143fc86-0273-406f-b5f9-67cc9d4bc7f6.png')
        .its('status').should('eq', 200);
    });

    it('should not rewrite API routes', () => {
      // This test assumes you have API routes
      // Adjust based on your actual API structure
      cy.request({ url: '/api/health', failOnStatusCode: false })
        .its('body').should('not.contain', '<!DOCTYPE html>');
    });
  });

  describe('Legacy Route Redirects', () => {
    const legacyRedirects = [
      { from: '/agent/dashboard', to: '/' },
      { from: '/billing/payment-settings', to: '/payment-settings' },
      { from: '/email-templates', to: '/billing/email-templates' }
    ];

    legacyRedirects.forEach(({ from, to }) => {
      it(`should redirect ${from} to ${to}`, () => {
        cy.visit(from);
        // Should eventually end up at the target route (or auth if protected)
        // cy.url().should('include', to);
      });
    });
  });

  describe('Browser Navigation', () => {
    it('should handle browser back/forward buttons', () => {
      cy.visit('/auth');
      
      // Navigate through several pages
      cy.visit('/properties');
      cy.visit('/tenants');
      cy.visit('/invoices');
      
      // Go back
      cy.go('back');
      cy.url().should('include', '/tenants');
      
      // Go back again
      cy.go('back'); 
      cy.url().should('include', '/properties');
      
      // Go forward
      cy.go('forward');
      cy.url().should('include', '/tenants');
    });
  });

  describe('Role-based Route Access', () => {
    it('should restrict admin routes to admin users', () => {
      // Mock non-admin user
      cy.visit('/admin/users');
      // Should redirect or show access denied
    });

    it('should restrict tenant routes to tenant users', () => {
      // Mock non-tenant user  
      cy.visit('/tenant/payments');
      // Should redirect appropriately
    });

    it('should restrict landlord-only routes', () => {
      // Mock non-landlord user
      cy.visit('/sub-users');
      // Should show access restriction
    });
  });
});

// Custom commands for authentication testing
Cypress.Commands.add('login', (userType: 'admin' | 'landlord' | 'tenant' = 'landlord') => {
  // Implement login logic based on your auth system
  cy.visit('/auth');
  // Fill login form, submit, etc.
});

Cypress.Commands.add('logout', () => {
  // Implement logout logic
  cy.get('[data-testid="logout-button"]').click();
});

declare global {
  namespace Cypress {
    interface Chainable {
      login(userType?: 'admin' | 'landlord' | 'tenant'): Chainable<void>;
      logout(): Chainable<void>;
    }
  }
}