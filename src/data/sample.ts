// SYNTHETIC SAMPLE DATA. Every person below is fictional and was written by hand for this demo.
// Relevance labels were assigned by hand BEFORE running any of the scorers:
//   3 = excellent fit, 2 = good fit, 1 = partial fit, 0 = not a fit.
// Some profiles are intentionally adversarial: paraphrase-heavy strong fits (hard for keyword
// matching) and keyword-dense non-fits (easy to fool keyword matching).

export const SAMPLE_JD = `Senior Machine Learning Engineer, Search & Ranking
Requirements:
- 4+ years building and deploying machine learning models in production.
- Strong Python skills and hands-on experience with PyTorch or TensorFlow.
- Experience with information retrieval, search ranking or recommender systems.
- Experience with text embeddings and vector search (FAISS or approximate nearest neighbour indexes).
- Designs offline evaluation and online A/B tests to measure model quality.
- Comfortable with large-scale data pipelines using Spark, Airflow or similar tools.
- Clear written communication and experience mentoring other engineers.`;

export interface SampleCandidate {
  key: string;
  label: number;
  why: string;
  block: string;
}

export const SAMPLE_CANDIDATES: SampleCandidate[] = [
  {
    key: 'priya',
    label: 3,
    why: 'Production ranking ML, embeddings, A/B tests, mentoring: covers almost everything with explicit terms.',
    block: `Priya Raman, Staff ML Engineer
Six years building search ranking models that serve 40 million queries a day.
Trained learning-to-rank models in PyTorch and deployed them behind a low-latency Python service.
Built a semantic retrieval layer with sentence embeddings and a FAISS index.
Owned the offline evaluation suite (nDCG, recall) and ran dozens of online A/B tests.
Mentored four engineers and wrote the team's design-doc guidelines.`,
  },
  {
    key: 'tomas',
    label: 3,
    why: 'Strong fit described almost entirely in paraphrase: few literal keyword overlaps.',
    block: `Tomás Herrera, Applied Scientist
For five years I owned the system that decides which listings shoppers see first on a large marketplace.
I turned product descriptions into dense vectors and served nearest-neighbour lookups under 20 ms.
Every model change shipped only after a controlled experiment on live traffic and a replayed historical benchmark.
My daily tools were Python and Torch, and I kept nightly batch jobs on our Hadoop cluster healthy.
I coached two junior scientists through their first launches and wrote most of our internal docs.`,
  },
  {
    key: 'ravi',
    label: 3,
    why: 'IR PhD plus industry retrieval; dual encoders, HNSW, production deployment.',
    block: `Ravi Shankar, Senior Research Engineer
PhD in information retrieval, followed by four years in industry search teams.
Designed dual-encoder retrieval models and HNSW approximate nearest neighbour indexes for document search.
Shipped models to production with TensorFlow Serving and monitored quality regressions.
Built offline relevance benchmarks with graded human judgments.
Supervised interns and gave internal talks on retrieval evaluation.`,
  },
  {
    key: 'aiko',
    label: 2,
    why: 'Recommender systems in PyTorch, production; no vector search, no mentoring.',
    block: `Aiko Tanaka, Machine Learning Engineer
Built recommender systems for a music streaming app, from candidate generation to the final ranking model.
Implemented two-tower models in PyTorch and productionised them with Python microservices.
Measured impact with A/B tests on engagement metrics.
Wrote feature pipelines on Spark.`,
  },
  {
    key: 'daniel',
    label: 2,
    why: 'Large-scale data pipelines and some production ML; no search/ranking.',
    block: `Daniel Okafor, Senior Data Engineer
Seven years designing large-scale data pipelines with Spark and Airflow processing 5 TB per day.
Partnered with data scientists to deploy fraud detection models to production in Python.
Introduced data quality checks that cut pipeline incidents by half.
Mentored three junior data engineers and ran the team's onboarding.`,
  },
  {
    key: 'kwame',
    label: 2,
    why: 'Classic search relevance engineering and A/B tests; light ML, mostly Java.',
    block: `Kwame Mensah, Search Engineer
Five years tuning Elasticsearch and Solr relevance for an e-commerce catalogue.
Built query understanding rules, synonyms and boosting functions in Java.
Ran A/B tests on search result changes and tracked click-through rate.
Recently started experimenting with a gradient-boosted re-ranker in Python.`,
  },
  {
    key: 'sofia',
    label: 1,
    why: 'Analytics data scientist with experimentation skills; no production ML or search.',
    block: `Sofia Lindqvist, Data Scientist
Analysed product funnels and designed online experiments for a subscription business.
Strong Python and SQL; built dashboards and churn analyses.
Presented findings to executives and wrote clear analysis reports.`,
  },
  {
    key: 'elena',
    label: 1,
    why: 'Research-only deep learning (vision); no production, no retrieval.',
    block: `Elena Popescu, ML Research Intern
Published two workshop papers on image segmentation using PyTorch.
Reproduced several deep learning baselines and contributed to an open-source vision library.
Comfortable with Python, NumPy and running experiments on GPU clusters.`,
  },
  {
    key: 'jonas',
    label: 1,
    why: 'Solid backend/data engineering and mentoring; no ML.',
    block: `Jonas Becker, Backend Engineer
Builds event-driven services in Python and Go with Kafka.
Maintains the company's Airflow deployment and several ETL jobs.
Leads code reviews and mentors new hires on the backend team.`,
  },
  {
    key: 'marcus',
    label: 0,
    why: 'TRAP: technical recruiter whose profile is dense with the exact keywords.',
    block: `Marcus Bell, Technical Recruiter
Recruited machine learning engineers for search ranking, recommender systems and vector search teams.
Screened candidates on PyTorch, TensorFlow, FAISS, Spark and Airflow experience.
Coordinated A/B tests of our job-post wording to improve applicant conversion.`,
  },
  {
    key: 'lucy',
    label: 0,
    why: 'TRAP: product marketer writing about AI search, not building it.',
    block: `Lucy Chen, Product Marketing Manager
Launched go-to-market campaigns for an AI-powered search ranking product.
Wrote blog posts explaining embeddings and vector search to non-technical buyers.
Managed the editorial calendar and coordinated with sales.`,
  },
  {
    key: 'hannah',
    label: 0,
    why: 'Frontend engineer; unrelated stack.',
    block: `Hannah Weiss, Frontend Engineer
Builds accessible React and TypeScript interfaces and maintains a design system.
Improved page load performance by 35 percent.
Mentors junior developers and writes clear technical documentation.`,
  },
];

export const SAMPLE_PROFILES = SAMPLE_CANDIDATES.map((c) => c.block).join('\n---\n');
