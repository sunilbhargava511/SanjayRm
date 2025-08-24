-- Add calculators table for financial calculator tools
CREATE TABLE IF NOT EXISTS calculators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  active INTEGER DEFAULT 1, -- boolean: 1 = true, 0 = false
  created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- Create index for ordering calculators
CREATE INDEX IF NOT EXISTS idx_calculators_order_active ON calculators(active, order_index);

-- Insert some sample calculators
INSERT INTO calculators (id, name, url, description, order_index) VALUES 
('calc_mortgage', 'Mortgage Calculator', 'https://www.calculator.net/mortgage-calculator.html', 'Calculate monthly mortgage payments, total interest, and amortization schedules for your home loan.', 1),
('calc_retirement', 'Retirement Calculator', 'https://www.calculator.net/retirement-calculator.html', 'Plan for your retirement by calculating how much you need to save and when you can retire comfortably.', 2),
('calc_compound_interest', 'Compound Interest Calculator', 'https://www.calculator.net/interest-calculator.html', 'See how your investments can grow over time with the power of compound interest.', 3),
('calc_budget', 'Budget Calculator', 'https://www.calculator.net/budget-calculator.html', 'Create and track a monthly budget to manage your income and expenses effectively.', 4),
('calc_debt_payoff', 'Debt Payoff Calculator', 'https://www.calculator.net/debt-payoff-calculator.html', 'Create a strategy to pay off your debts faster and save on interest payments.', 5);