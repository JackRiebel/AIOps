// ============================================================================
// ThousandEyes Types
// ============================================================================

export interface Test {
  testId: number;
  testName: string;
  type: string;
  enabled: number;
  interval: number;
  createdDate: string;
  modifiedDate: string;
}

export interface TestResult {
  timestamp: string;
  responseTime?: number;
  availability?: number;
  loss?: number;
  latency?: number;
  jitter?: number;
  throughput?: number;
  [key: string]: any;
}

export interface Alert {
  alertId: number;
  testName: string;
  active: number;
  ruleExpression: string;
  dateStart: string;
  dateEnd?: string;
  violationCount: number;
  severity: string;
}

export interface Agent {
  agentId: number;
  agentName: string;
  agentType: string;
  countryId: string;
  enabled: number;
  ipAddresses: string[];
  location: string;
  network: string;
}

export type TabType = 'tests' | 'alerts' | 'agents';

export interface SelectedDataPoint {
  testId: number;
  data: TestResult;
}
