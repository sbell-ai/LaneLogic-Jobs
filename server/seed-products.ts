import { getUncachableStripeClient } from './stripeClient';

const products = [
  {
    name: "LaneLogic Jobs Basic - Job Seeker",
    description: "Unlimited job applications, priority status, access to basic resources, and profile visibility boost.",
    amount: 1900,
    metadata: { tier: "basic", role: "job_seeker" },
  },
  {
    name: "LaneLogic Jobs Premium - Job Seeker",
    description: "All Basic features plus unlimited resumes, featured profile badge, all premium resources, and career coaching.",
    amount: 4900,
    metadata: { tier: "premium", role: "job_seeker" },
  },
  {
    name: "LaneLogic Jobs Basic - Employer",
    description: "Post up to 10 jobs/month, featured listings, CSV bulk upload, and applicant filtering.",
    amount: 7900,
    metadata: { tier: "basic", role: "employer" },
  },
  {
    name: "LaneLogic Jobs Premium - Employer",
    description: "Unlimited job postings, priority placement, advanced analytics, and dedicated account manager.",
    amount: 19900,
    metadata: { tier: "premium", role: "employer" },
  },
];

async function seedProducts() {
  const stripe = await getUncachableStripeClient();

  for (const product of products) {
    const existing = await stripe.products.search({ query: `name:'${product.name}'` });
    if (existing.data.length > 0) {
      console.log(`Product already exists: ${product.name}`);
      continue;
    }

    const created = await stripe.products.create({
      name: product.name,
      description: product.description,
      metadata: product.metadata,
    });

    const price = await stripe.prices.create({
      product: created.id,
      unit_amount: product.amount,
      currency: "usd",
      recurring: { interval: "month" },
    });

    console.log(`Created: ${product.name} -> price ${price.id} ($${product.amount / 100}/mo)`);
  }

  console.log("Product seeding complete!");
}

seedProducts().catch(console.error);
