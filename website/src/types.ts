export type PageType = 'home' | 'features' | 'pricing' | 'about';

export interface TaskItem {
  id: string;
  title: string;
  workspace: string;
  category: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  deadline: string;
  completed: boolean;
}

export interface Founder {
  name: string;
  role: string;
  subtitle: string;
  avatar: string;
  bio: string;
}

export interface Milestone {
  date: string;
  title: string;
  description: string;
  tag?: string;
}

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  company: string;
  avatar: string;
  metric?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
  category?: 'General' | 'Pricing' | 'Security' | 'Integrations';
}

export interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceAnnually: number;
  popular?: boolean;
  features: string[];
  ctaText: string;
}
