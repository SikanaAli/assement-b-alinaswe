import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';

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

const API_BASE_URL_KEY = 'submission-approval-workflow-api-base-url';
const SESSION_KEY = 'submission-approval-workflow-session';
const defaultApiBaseUrl = 'http://127.0.0.1:3000';

const categories: Category[] = ['GENERAL', 'FINANCE', 'HR', 'IT'];

const emptyForm: ApplicationFormValues = {
  title: '',
  category: 'GENERAL',
  description: '',
  amount: '',
};

function App() {
  return (
    <BrowserRouter>
      <ApplicantApp />
    </BrowserRouter>
  );
}

function ApplicantApp() {
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
      return;
    }

    localStorage.removeItem(SESSION_KEY);
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

      if (payload.user.role !== 'APPLICANT') {
        throw new Error('This frontend currently supports applicant views only.');
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-section">
          <h1 className="brand">Submission Approval Workflow</h1>
          <p className="muted">
            Applicant workspace for creating, editing, and submitting applications.
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
              <h2 className="section-title">Applicant sign in</h2>
              <p className="muted">
                Use the seeded applicant account to access the application pages.
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
            <button className="secondary-button" type="button" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        )}

        <nav className="sidebar-section nav-links" aria-label="Applicant navigation">
          <Link className="nav-link" to="/my-applications">
            My Applications
          </Link>
          <Link className="nav-link" to="/applications/new">
            New Application
          </Link>
        </nav>
      </aside>

      <main className="content">
        <Routes>
          <Route
            path="/"
            element={<Navigate to={session ? '/my-applications' : '/my-applications'} replace />}
          />
          <Route
            path="/my-applications"
            element={
              <ApplicantRoute session={session}>
                <MyApplicationsPage api={api} />
              </ApplicantRoute>
            }
          />
          <Route
            path="/applications/new"
            element={
              <ApplicantRoute session={session}>
                <ApplicationFormPage api={api} mode="create" />
              </ApplicantRoute>
            }
          />
          <Route
            path="/applications/:id/edit"
            element={
              <ApplicantRoute session={session}>
                <ApplicationFormPage api={api} mode="edit" />
              </ApplicantRoute>
            }
          />
          <Route
            path="/applications/:id"
            element={
              <ApplicantRoute session={session}>
                <ApplicationDetailPage api={api} />
              </ApplicantRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

function ApplicantRoute({
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
          Sign in with the applicant account to open application pages.
        </p>
      </section>
    );
  }

  if (session.user.role !== 'APPLICANT') {
    return (
      <section className="panel">
        <h2 className="page-title">Applicant access only</h2>
        <p className="muted">
          This frontend currently exposes only applicant-facing views.
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
          <FormField
            label="Title"
            error={validationErrors.title}
            htmlFor="title"
          >
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

          <FormField
            label="Amount"
            error={validationErrors.amount}
            htmlFor="amount"
          >
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

function ApplicationDetailPage({ api }: { api: ApiClient }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

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
  }, [api, id, location.key]);

  async function handleSubmitApplication() {
    if (!id) {
      return;
    }

    setSubmitLoading(true);
    setError('');

    try {
      await api.post<ApplicationDetail>(`/applications/${id}/submit`);
      const refreshed = await api.get<ApplicationDetail>(`/applications/${id}`);
      setApplication(refreshed);
      navigate(`/applications/${id}`, { replace: true });
    } catch (apiError) {
      setError((apiError as ApiError).message);
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="page-header">
        <div>
          <h2 className="page-title">Application Detail</h2>
          <p className="muted">Review the application data and its audit trail.</p>
        </div>
        <Link className="secondary-button link-button" to="/my-applications">
          Back to list
        </Link>
      </div>

      {loading ? <div className="state-card">Loading application…</div> : null}
      {!loading && error ? <div className="state-card error-banner">{error}</div> : null}

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
              <p className="muted">
                Draft applications can still be edited or submitted.
              </p>
              <div className="stack-actions">
                {application.status === 'DRAFT' ? (
                  <>
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
                      onClick={handleSubmitApplication}
                    >
                      {submitLoading ? 'Submitting…' : 'Submit application'}
                    </button>
                  </>
                ) : (
                  <div className="state-card">
                    This application is no longer editable because it is not in draft.
                  </div>
                )}
              </div>
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

type ApiClientOptions = {
  apiBaseUrl: string;
  accessToken: string | null;
  onUnauthorized: () => void;
};

type ApiError = {
  code?: string;
  message: string;
  statusCode: number;
};

type ApiClient = ReturnType<typeof createApiClient>;

function createApiClient({
  apiBaseUrl,
  accessToken,
  onUnauthorized,
}: ApiClientOptions) {
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
