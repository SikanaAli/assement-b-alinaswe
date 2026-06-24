import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

type Role = 'APPLICANT' | 'REVIEWER';
type Category = 'GENERAL' | 'FINANCE' | 'HR' | 'IT';
type Status =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'RETURNED';

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type Session = {
  accessToken: string;
  user: AuthUser;
};

type ApplicationSummary = {
  id: string;
  title: string;
  category: Category;
  description?: string | null;
  amount?: string | number | null;
  status: Status;
  createdAt: string;
  updatedAt: string;
};

type ReviewerQueueItem = {
  id: string;
  title: string;
  category: Category;
  amount?: string | number | null;
  status: Status;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
};

type AuditLog = {
  id: string;
  oldStatus: Status;
  newStatus: Status;
  comment?: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
};

type ApplicationDetail = ApplicationSummary & {
  ownerId: string;
  auditLogs: AuditLog[];
};

type ApplicationFormValues = {
  title: string;
  category: Category;
  description: string;
  amount: string;
};

type ValidationErrors = Partial<Record<keyof ApplicationFormValues, string>>;

type ReviewerTransitionValues = {
  comment: string;
};

type ReviewerTransitionErrors = {
  comment?: string;
};

type ApiError = {
  code?: string;
  message: string;
  statusCode: number;
};

type ApiClient = ReturnType<typeof createApiClient>;

const API_BASE_URL_KEY = 'submission-approval-workflow-api-base-url';
const SESSION_KEY = 'submission-approval-workflow-session';
const defaultApiBaseUrl = 'http://127.0.0.1:3000';
const categories: Category[] = ['GENERAL', 'FINANCE', 'HR', 'IT'];
const reviewerQueueFilters: Array<'all' | Status> = [
  'all',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'RETURNED',
];
const reviewerActionLabels: Record<
  'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RETURNED',
  string
> = {
  UNDER_REVIEW: 'Mark Under Review',
  APPROVED: 'Approve',
  REJECTED: 'Reject',
  RETURNED: 'Return for Changes',
};

const emptyForm: ApplicationFormValues = {
  title: '',
  category: 'GENERAL',
  description: '',
  amount: '',
};

function App() {
  return (
    <BrowserRouter>
      <WorkflowApp />
    </BrowserRouter>
  );
}

function WorkflowApp() {
  const [apiBaseUrl, setApiBaseUrl] = useState(() =>
    localStorage.getItem(API_BASE_URL_KEY) ?? defaultApiBaseUrl,
  );
  const [session, setSession] = useState<Session | null>(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(API_BASE_URL_KEY, apiBaseUrl);
  }, [apiBaseUrl]);

  useEffect(() => {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [session]);

  const api = useMemo(
    () =>
      createApiClient({
        apiBaseUrl,
        accessToken: session?.accessToken ?? null,
        onUnauthorized: () => {
          setSession(null);
          setAuthError('Your session expired. Sign in again.');
        },
      }),
    [apiBaseUrl, session?.accessToken],
  );

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '').trim();

    setAuthLoading(true);
    setAuthError('');

    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Sign in failed.');
      }

      setSession(payload as Session);
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'Sign in failed unexpectedly.',
      );
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    setSession(null);
    setAuthError('');
  }

  const homePath =
    session?.user.role === 'REVIEWER' ? '/reviewer/queue' : '/my-applications';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-section">
          <h1 className="brand">Submission Approval Workflow</h1>
          <p className="muted">
            Lightweight applicant and reviewer workspace for managing applications.
          </p>
        </div>

        <div className="sidebar-section">
          <label className="field-label" htmlFor="api-base-url">
            API base URL
          </label>
          <input
            id="api-base-url"
            className="text-input"
            value={apiBaseUrl}
            onChange={(event) => setApiBaseUrl(event.target.value)}
            placeholder={defaultApiBaseUrl}
          />
        </div>

        {!session ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="sidebar-section">
              <h2 className="section-title">Sign in</h2>
              <p className="muted">
                Use the seeded applicant or reviewer account to open the workspace.
              </p>
            </div>

            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="text-input"
              name="email"
              type="email"
              defaultValue="applicant@example.com"
              required
            />

            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="text-input"
              name="password"
              type="password"
              defaultValue="password123"
              required
            />

            {authError ? <p className="error-banner">{authError}</p> : null}

            <button className="primary-button" type="submit" disabled={authLoading}>
              {authLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <div className="sidebar-section">
            <h2 className="section-title">Signed in</h2>
            <p className="muted">{session.user.name}</p>
            <p className="muted">{session.user.email}</p>
            <p className="muted">Role: {session.user.role}</p>
            <button className="secondary-button" type="button" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        )}

        <nav className="sidebar-section nav-links" aria-label="Workspace navigation">
          {session?.user.role === 'REVIEWER' ? (
            <Link className="nav-link" to="/reviewer/queue">
              Reviewer Queue
            </Link>
          ) : (
            <>
              <Link className="nav-link" to="/my-applications">
                My Applications
              </Link>
              <Link className="nav-link" to="/applications/new">
                New Application
              </Link>
            </>
          )}
        </nav>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to={homePath} replace />} />
          <Route
            path="/my-applications"
            element={
              <RequireRole session={session} role="APPLICANT">
                <MyApplicationsPage api={api} />
              </RequireRole>
            }
          />
          <Route
            path="/applications/new"
            element={
              <RequireRole session={session} role="APPLICANT">
                <ApplicationFormPage api={api} mode="create" />
              </RequireRole>
            }
          />
          <Route
            path="/applications/:id/edit"
            element={
              <RequireRole session={session} role="APPLICANT">
                <ApplicationFormPage api={api} mode="edit" />
              </RequireRole>
            }
          />
          <Route
            path="/applications/:id"
            element={
              <RequireSignedIn session={session}>
                <ApplicationDetailPage api={api} session={session} />
              </RequireSignedIn>
            }
          />
          <Route
            path="/reviewer/queue"
            element={
              <RequireRole session={session} role="REVIEWER">
                <ReviewerQueuePage api={api} />
              </RequireRole>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

function RequireSignedIn({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  if (!session) {
    return (
      <section className="panel">
        <h2 className="page-title">Sign in required</h2>
        <p className="muted">
          Sign in with one of the seeded accounts to access this page.
        </p>
      </section>
    );
  }

  return <>{children}</>;
}

function RequireRole({
  children,
  role,
  session,
}: {
  children: ReactNode;
  role: Role;
  session: Session | null;
}) {
  if (!session) {
    return (
      <section className="panel">
        <h2 className="page-title">Sign in required</h2>
        <p className="muted">
          Sign in with one of the seeded accounts to access this page.
        </p>
      </section>
    );
  }

  if (session.user.role !== role) {
    return (
      <section className="panel">
        <h2 className="page-title">Access restricted</h2>
        <p className="muted">
          This page is available only to {role.toLowerCase()} users.
        </p>
      </section>
    );
  }

  return <>{children}</>;
}

function MyApplicationsPage({ api }: { api: ApiClient }) {
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');

    api
      .get<ApplicationSummary[]>('/applications/my')
      .then((data) => {
        if (active) {
          setApplications(data);
        }
      })
      .catch((apiError: ApiError) => {
        if (active) {
          setError(apiError.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [api]);

  return (
    <section className="panel">
      <div className="page-header">
        <div>
          <h2 className="page-title">My Applications</h2>
          <p className="muted">
            Review your drafts and submitted applications in one place.
          </p>
        </div>
        <Link className="primary-button link-button" to="/applications/new">
          Create new application
        </Link>
      </div>

      {loading ? <div className="state-card">Loading applications…</div> : null}
      {!loading && error ? <div className="state-card error-banner">{error}</div> : null}
      {!loading && !error && applications.length === 0 ? (
        <div className="state-card">
          <h3 className="state-title">No applications yet</h3>
          <p className="muted">Create your first draft application to get started.</p>
        </div>
      ) : null}

      {!loading && !error && applications.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id}>
                  <td>{application.title}</td>
                  <td>{application.category}</td>
                  <td>{formatAmount(application.amount)}</td>
                  <td>
                    <StatusBadge status={application.status} />
                  </td>
                  <td>{formatDateTime(application.updatedAt)}</td>
                  <td>
                    <Link to={`/applications/${application.id}`}>View details</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function ReviewerQueuePage({ api }: { api: ApiClient }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFilter =
    (searchParams.get('status') as 'all' | Status | null) ?? 'all';
  const [items, setItems] = useState<ReviewerQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');

    const query =
      selectedFilter !== 'all' ? `?status=${encodeURIComponent(selectedFilter)}` : '';

    api
      .get<ReviewerQueueItem[]>(`/applications/reviewer/queue${query}`)
      .then((data) => {
        if (active) {
          setItems(data);
        }
      })
      .catch((apiError: ApiError) => {
        if (active) {
          setError(apiError.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [api, selectedFilter]);

  function handleFilterChange(nextFilter: 'all' | Status) {
    if (nextFilter === 'all') {
      setSearchParams({});
      return;
    }

    setSearchParams({ status: nextFilter });
  }

  return (
    <section className="panel">
      <div className="page-header">
        <div>
          <h2 className="page-title">Reviewer Queue</h2>
          <p className="muted">
            Review submitted applications and move them through the workflow.
          </p>
        </div>
      </div>

      <div className="filter-row" role="group" aria-label="Queue status filter">
        {reviewerQueueFilters.map((filter) => (
          <button
            key={filter}
            type="button"
            className={`filter-chip ${selectedFilter === filter ? 'is-active' : ''}`}
            onClick={() => handleFilterChange(filter)}
          >
            {filter === 'all' ? 'All' : filter}
          </button>
        ))}
      </div>

      {loading ? <div className="state-card">Loading reviewer queue…</div> : null}
      {!loading && error ? <div className="state-card error-banner">{error}</div> : null}
      {!loading && !error && items.length === 0 ? (
        <div className="state-card">
          <h3 className="state-title">No applications in this queue</h3>
          <p className="muted">Try another filter or check back later.</p>
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Owner</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>
                    <div>{item.owner.name}</div>
                    <div className="muted">{item.owner.email}</div>
                  </td>
                  <td>{item.category}</td>
                  <td>{formatAmount(item.amount)}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>{formatDateTime(item.updatedAt)}</td>
                  <td>
                    <Link to={`/applications/${item.id}`}>View details</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function ApplicationFormPage({
  api,
  mode,
}: {
  api: ApiClient;
  mode: 'create' | 'edit';
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [values, setValues] = useState<ApplicationFormValues>(emptyForm);
  const [status, setStatus] = useState<Status | null>(mode === 'create' ? 'DRAFT' : null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    if (mode !== 'edit' || !id) {
      return;
    }

    let active = true;

    setLoading(true);
    setError('');

    api
      .get<ApplicationDetail>(`/applications/${id}`)
      .then((application) => {
        if (!active) {
          return;
        }

        setValues({
          title: application.title,
          category: application.category,
          description: application.description ?? '',
          amount:
            application.amount !== null && application.amount !== undefined
              ? String(application.amount)
              : '',
        });
        setStatus(application.status);
      })
      .catch((apiError: ApiError) => {
        if (active) {
          setError(apiError.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [api, id, mode]);

  function updateValue<K extends keyof ApplicationFormValues>(
    key: K,
    value: ApplicationFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const errors = validateApplicationForm(values);
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setSaving(true);

    try {
      const payload = toApplicationPayload(values);
      const response =
        mode === 'create'
          ? await api.post<ApplicationSummary>('/applications', payload)
          : await api.patch<ApplicationDetail>(`/applications/${id}`, payload);

      navigate(`/applications/${response.id}`);
    } catch (apiError) {
      setError((apiError as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitApplication() {
    if (!id) {
      return;
    }

    setSubmitLoading(true);
    setError('');

    try {
      const response = await api.post<ApplicationDetail>(`/applications/${id}/submit`);
      navigate(`/applications/${response.id}`);
    } catch (apiError) {
      setError((apiError as ApiError).message);
    } finally {
      setSubmitLoading(false);
    }
  }

  const isDraft = status === 'DRAFT';

  return (
    <section className="panel">
      <div className="page-header">
        <div>
          <h2 className="page-title">
            {mode === 'create' ? 'New Application' : 'Edit Application'}
          </h2>
          <p className="muted">
            Complete the application fields and save your draft before submission.
          </p>
        </div>
        <Link className="secondary-button link-button" to="/my-applications">
          Back to list
        </Link>
      </div>

      {loading ? <div className="state-card">Loading application…</div> : null}
      {!loading && error ? <div className="state-card error-banner">{error}</div> : null}

      {!loading ? (
        <form className="form-layout" onSubmit={handleSave} noValidate>
          <FormField label="Title" error={validationErrors.title} htmlFor="title">
            <input
              id="title"
              className="text-input"
              value={values.title}
              onChange={(event) => updateValue('title', event.target.value)}
            />
          </FormField>

          <FormField
            label="Category"
            error={validationErrors.category}
            htmlFor="category"
          >
            <select
              id="category"
              className="text-input"
              value={values.category}
              onChange={(event) =>
                updateValue('category', event.target.value as Category)
              }
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Description"
            error={validationErrors.description}
            htmlFor="description"
          >
            <textarea
              id="description"
              className="text-area"
              rows={6}
              value={values.description}
              onChange={(event) => updateValue('description', event.target.value)}
            />
          </FormField>

          <FormField label="Amount" error={validationErrors.amount} htmlFor="amount">
            <input
              id="amount"
              className="text-input"
              type="number"
              min="0"
              step="0.01"
              value={values.amount}
              onChange={(event) => updateValue('amount', event.target.value)}
            />
          </FormField>

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? 'Saving…' : mode === 'create' ? 'Create draft' : 'Save changes'}
            </button>

            {mode === 'edit' && isDraft ? (
              <button
                className="secondary-button"
                type="button"
                disabled={submitLoading}
                onClick={handleSubmitApplication}
              >
                {submitLoading ? 'Submitting…' : 'Submit application'}
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}

function ApplicationDetailPage({
  api,
  session,
}: {
  api: ApiClient;
  session: Session | null;
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [reviewerLoading, setReviewerLoading] = useState<Status | null>(null);
  const [reviewerValues, setReviewerValues] = useState<ReviewerTransitionValues>({
    comment: '',
  });
  const [reviewerErrors, setReviewerErrors] = useState<ReviewerTransitionErrors>({});

  useEffect(() => {
    if (!id) {
      return;
    }

    let active = true;

    setLoading(true);
    setError('');

    api
      .get<ApplicationDetail>(`/applications/${id}`)
      .then((data) => {
        if (active) {
          setApplication(data);
        }
      })
      .catch((apiError: ApiError) => {
        if (active) {
          setError(apiError.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [api, id]);

  async function refreshDetail() {
    if (!id) {
      return;
    }

    const refreshed = await api.get<ApplicationDetail>(`/applications/${id}`);
    setApplication(refreshed);
  }

  async function handleSubmitApplication() {
    if (!id) {
      return;
    }

    setSubmitLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      await api.post(`/applications/${id}/submit`);
      await refreshDetail();
      setSuccessMessage('Application submitted successfully.');
    } catch (apiError) {
      setError((apiError as ApiError).message);
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleReviewerTransition(
    targetStatus: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RETURNED',
  ) {
    if (!id) {
      return;
    }

    const errors = validateReviewerTransition(targetStatus, reviewerValues.comment);
    setReviewerErrors(errors);

    if (errors.comment) {
      return;
    }

    setReviewerLoading(targetStatus);
    setError('');
    setSuccessMessage('');

    try {
      await api.post(`/applications/${id}/transition`, {
        status: targetStatus,
        comment: reviewerValues.comment.trim() || undefined,
      });
      await refreshDetail();
      setReviewerValues({ comment: '' });
      setSuccessMessage(`Application moved to ${targetStatus}.`);
    } catch (apiError) {
      setError((apiError as ApiError).message);
    } finally {
      setReviewerLoading(null);
    }
  }

  const isApplicant = session?.user.role === 'APPLICANT';
  const isReviewer = session?.user.role === 'REVIEWER';
  const isDraft = application?.status === 'DRAFT';

  return (
    <section className="panel">
      <div className="page-header">
        <div>
          <h2 className="page-title">Application Detail</h2>
          <p className="muted">Review the application data and its audit trail.</p>
        </div>
        <Link
          className="secondary-button link-button"
          to={isReviewer ? '/reviewer/queue' : '/my-applications'}
        >
          Back to list
        </Link>
      </div>

      {loading ? <div className="state-card">Loading application…</div> : null}
      {!loading && error ? <div className="state-card error-banner">{error}</div> : null}
      {!loading && successMessage ? (
        <div className="state-card success-banner">{successMessage}</div>
      ) : null}

      {!loading && application ? (
        <>
          <div className="detail-grid">
            <div className="detail-card">
              <h3 className="detail-title">{application.title}</h3>
              <p className="muted">{application.description || 'No description provided.'}</p>
              <dl className="detail-list">
                <div>
                  <dt>Category</dt>
                  <dd>{application.category}</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{formatAmount(application.amount)}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <StatusBadge status={application.status} />
                  </dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDateTime(application.createdAt)}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDateTime(application.updatedAt)}</dd>
                </div>
              </dl>
            </div>

            <div className="detail-card">
              <h3 className="detail-title">Actions</h3>

              {isApplicant ? (
                <ApplicantActionsCard
                  application={application}
                  submitLoading={submitLoading}
                  onSubmit={handleSubmitApplication}
                />
              ) : null}

              {isReviewer ? (
                <ReviewerActionsCard
                  application={application}
                  reviewerErrors={reviewerErrors}
                  reviewerLoading={reviewerLoading}
                  reviewerValues={reviewerValues}
                  setReviewerValues={setReviewerValues}
                  onTransition={handleReviewerTransition}
                />
              ) : null}

              {!isApplicant && !isReviewer ? (
                <div className="state-card">No actions available for this role.</div>
              ) : null}

              {isApplicant && !isDraft ? (
                <div className="state-card">
                  This application is no longer editable because it is not in draft.
                </div>
              ) : null}
            </div>
          </div>

          <section className="audit-section">
            <h3 className="detail-title">Audit Log</h3>
            {application.auditLogs.length === 0 ? (
              <div className="state-card">No workflow history yet.</div>
            ) : (
              <ol className="audit-list">
                {application.auditLogs.map((log) => (
                  <li className="audit-item" key={log.id}>
                    <div className="audit-row">
                      <strong>
                        {log.oldStatus} → {log.newStatus}
                      </strong>
                      <span className="muted">{formatDateTime(log.createdAt)}</span>
                    </div>
                    <div className="muted">
                      {log.actor.name} ({log.actor.email})
                    </div>
                    <div>{log.comment?.trim() ? log.comment : 'No comment provided.'}</div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}

function ApplicantActionsCard({
  application,
  submitLoading,
  onSubmit,
}: {
  application: ApplicationDetail;
  submitLoading: boolean;
  onSubmit: () => void;
}) {
  if (application.status !== 'DRAFT') {
    return (
      <p className="muted">Draft applications can still be edited or submitted.</p>
    );
  }

  return (
    <div className="stack-actions">
      <p className="muted">Draft applications can still be edited or submitted.</p>
      <Link
        className="primary-button link-button"
        to={`/applications/${application.id}/edit`}
      >
        Edit application
      </Link>
      <button
        className="secondary-button"
        type="button"
        disabled={submitLoading}
        onClick={onSubmit}
      >
        {submitLoading ? 'Submitting…' : 'Submit application'}
      </button>
    </div>
  );
}

function ReviewerActionsCard({
  application,
  onTransition,
  reviewerErrors,
  reviewerLoading,
  reviewerValues,
  setReviewerValues,
}: {
  application: ApplicationDetail;
  onTransition: (
    targetStatus: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RETURNED',
  ) => void;
  reviewerErrors: ReviewerTransitionErrors;
  reviewerLoading: Status | null;
  reviewerValues: ReviewerTransitionValues;
  setReviewerValues: (values: ReviewerTransitionValues) => void;
}) {
  const availableActions = getReviewerActions(application.status);

  return (
    <div className="stack-actions">
      <p className="muted">
        Reviewer actions are hidden when the current status cannot move further.
      </p>

      {availableActions.length === 0 ? (
        <div className="state-card">No reviewer transitions are available.</div>
      ) : (
        <>
          <FormField label="Comment" error={reviewerErrors.comment} htmlFor="reviewer-comment">
            <textarea
              id="reviewer-comment"
              className="text-area"
              rows={4}
              value={reviewerValues.comment}
              onChange={(event) =>
                setReviewerValues({ comment: event.target.value })
              }
              placeholder="Required for reject and return actions."
            />
          </FormField>

          <div className="form-actions">
            {availableActions.map((status) => (
              <button
                key={status}
                className="secondary-button"
                type="button"
                disabled={Boolean(reviewerLoading)}
                onClick={() => onTransition(status)}
              >
                {reviewerLoading === status
                  ? 'Saving…'
                  : reviewerActionLabels[status]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FormField({
  children,
  error,
  htmlFor,
  label,
}: {
  children: ReactNode;
  error?: string;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="form-field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{status}</span>;
}

function getReviewerActions(currentStatus: Status) {
  if (currentStatus === 'SUBMITTED') {
    return ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED'] as const;
  }

  if (currentStatus === 'UNDER_REVIEW') {
    return ['APPROVED', 'REJECTED', 'RETURNED'] as const;
  }

  return [] as const;
}

function validateReviewerTransition(
  targetStatus: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RETURNED',
  comment: string,
): ReviewerTransitionErrors {
  if (
    (targetStatus === 'REJECTED' || targetStatus === 'RETURNED') &&
    comment.trim().length === 0
  ) {
    return {
      comment: 'A comment is required when rejecting or returning an application.',
    };
  }

  return {};
}

function validateApplicationForm(values: ApplicationFormValues): ValidationErrors {
  const errors: ValidationErrors = {};

  if (values.title.trim().length < 3) {
    errors.title = 'Title must be at least 3 characters long.';
  }

  if (!categories.includes(values.category)) {
    errors.category = 'Choose a valid category.';
  }

  if (values.amount.trim()) {
    const numericAmount = Number(values.amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      errors.amount = 'Amount must be a number greater than 0.';
    }
  }

  return errors;
}

function toApplicationPayload(values: ApplicationFormValues) {
  return {
    title: values.title.trim(),
    category: values.category,
    description: values.description.trim() || undefined,
    amount: values.amount.trim() ? Number(values.amount) : undefined,
  };
}

function formatAmount(amount?: string | number | null) {
  if (amount === null || amount === undefined || amount === '') {
    return '—';
  }

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return String(amount);
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function createApiClient({
  apiBaseUrl,
  accessToken,
  onUnauthorized,
}: {
  apiBaseUrl: string;
  accessToken: string | null;
  onUnauthorized: () => void;
}) {
  async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);

    if (!headers.has('Content-Type') && init?.body) {
      headers.set('Content-Type', 'application/json');
    }

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
    });

    const payload = await response.json().catch(() => null);

    if (response.status === 401) {
      onUnauthorized();
    }

    if (!response.ok) {
      throw {
        statusCode: response.status,
        code: payload?.code,
        message:
          payload?.message ??
          `Request failed with status ${response.status}.`,
      } satisfies ApiError;
    }

    return payload as T;
  }

  return {
    get<T>(path: string) {
      return requestJson<T>(path);
    },
    post<T>(path: string, body?: unknown) {
      return requestJson<T>(path, {
        method: 'POST',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    },
    patch<T>(path: string, body: unknown) {
      return requestJson<T>(path, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
  };
}

export default App;
