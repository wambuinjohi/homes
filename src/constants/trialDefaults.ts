/**
 * Centralized Trial Period Defaults
 * 
 * These constants define the default trial configuration values used throughout the application.
 * Update these values to change trial behavior system-wide.
 */

export const TRIAL_DEFAULTS = {
  /**
   * Default trial period in days for new landlords
   * This value should match the database setting in billing_settings.trial_settings
   */
  TRIAL_PERIOD_DAYS: 70,

  /**
   * Grace period in days after trial expiration
   * Users can still access limited features during grace period
   */
  GRACE_PERIOD_DAYS: 7,

  /**
   * Days before trial end to send payment reminders
   */
  REMINDER_DAYS: [3, 1],

  /**
   * Default SMS credits for new trial users
   */
  DEFAULT_SMS_CREDITS: 200,

  /**
   * Cost per SMS unit
   */
  SMS_COST_PER_UNIT: 0.05,

  /**
   * Enable auto invoice generation during trial
   */
  AUTO_INVOICE_GENERATION: true,
};

/**
 * Trial urgency levels based on days remaining
 */
export const TRIAL_URGENCY = {
  CRITICAL: 3,    // 0-3 days: Critical urgency (red)
  WARNING: 10,    // 4-10 days: Warning (orange)
  INFO: 20,       // 11-20 days: Info (blue)
  EARLY: 999,     // 21+ days: Early trial (green)
} as const;
