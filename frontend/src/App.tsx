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

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

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
const defaultApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000';
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
const nativeSelectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50';
const detailLabelClassName = 'text-sm font-medium text-muted-foreground';
const detailValueClassName = 'text-sm text-foreground';
const statusBadgeClassNames: Record<Status, string> = {
  DRAFT: 'border-transparent bg-slate-200 text-slate-700',
  SUBMITTED: 'border-transparent bg-blue-100 text-blue-700',
  UNDER_REVIEW: 'border-transparent bg-amber-100 text-amber-800',
  APPROVED: 'border-transparent bg-emerald-100 text-emerald-700',
  REJECTED: 'border-transparent bg-red-100 text-red-700',
  RETURNED: 'border-transparent bg-rose-100 text-rose-700',
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
    <div className="grid min-h-screen lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="border-b border-border/70 bg-slate-950 px-4 py-6 text-slate-100 lg:border-b-0 lg:border-r lg:px-6 lg:py-8">
        <div className="flex h-full flex-col gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Submission Approval Workflow
            </h1>
            <p className="text-sm leading-6 text-slate-300">
              Lightweight applicant and reviewer workspace for managing
              applications.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-100" htmlFor="api-base-url">
              API base URL
            </Label>
            <Input
              id="api-base-url"
              className="border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-400"
              value={apiBaseUrl}
              onChange={(event) => setApiBaseUrl(event.target.value)}
              placeholder={defaultApiBaseUrl}
            />
          </div>

          {!session ? (
            <Card className="border-slate-800 bg-slate-900/70 text-slate-100">
              <CardHeader className="space-y-2">
                <CardTitle>Sign in</CardTitle>
                <CardDescription className="text-slate-400">
                  Use the seeded applicant or reviewer account to open the
                  workspace.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleLogin}>
                  <FormField htmlFor="email" label="Email">
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue="applicant@example.com"
                      required
                      className="border-slate-700 bg-slate-950 text-slate-100"
                    />
                  </FormField>

                  <FormField htmlFor="password" label="Password">
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      defaultValue="password123"
                      required
                      className="border-slate-700 bg-slate-950 text-slate-100"
                    />
                  </FormField>

                  {authError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{authError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <Button className="w-full" type="submit" disabled={authLoading}>
                    {authLoading ? 'Signing in…' : 'Sign in'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-800 bg-slate-900/70 text-slate-100">
              <CardHeader className="space-y-2">
                <CardTitle>Signed in</CardTitle>
                <CardDescription className="text-slate-400">
                  Active backend session details.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-sm text-slate-200">
                  <p className="font-medium">{session.user.name}</p>
                  <p>{session.user.email}</p>
                  <p>Role: {session.user.role}</p>
                </div>
                <Button
                  className="w-full"
                  type="button"
                  variant="secondary"
                  onClick={handleLogout}
                >
                  Sign out
                </Button>
              </CardContent>
            </Card>
          )}

          <nav
            className="mt-auto grid gap-2"
            aria-label="Workspace navigation"
          >
            {session?.user.role === 'REVIEWER' ? (
              <Button
                asChild
                variant="secondary"
                className="justify-start bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-slate-50"
              >
                <Link to="/reviewer/queue">Reviewer Queue</Link>
              </Button>
            ) : (
              <>
                <Button
                  asChild
                  variant="secondary"
                  className="justify-start bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-slate-50"
                >
                  <Link to="/my-applications">My Applications</Link>
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  className="justify-start bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-slate-50"
                >
                  <Link to="/applications/new">New Application</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </aside>

      <main className="px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">
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
        </div>
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
      <AccessCard
        title="Sign in required"
        description="Sign in with one of the seeded accounts to access this page."
      />
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
      <AccessCard
        title="Sign in required"
        description="Sign in with one of the seeded accounts to access this page."
      />
    );
  }

  if (session.user.role !== role) {
    return (
      <AccessCard
        title="Access restricted"
        description={`This page is available only to ${role.toLowerCase()} users.`}
      />
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
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <CardTitle>My Applications</CardTitle>
          <CardDescription>
            Review your drafts and submitted applications in one place.
          </CardDescription>
        </div>
        <Button asChild>
          <Link to="/applications/new">Create new application</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <StateCard description="Loading applications…" /> : null}
        {!loading && error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {!loading && !error && applications.length === 0 ? (
          <StateCard
            title="No applications yet"
            description="Create your first draft application to get started."
          />
        ) : null}

        {!loading && !error && applications.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((application) => (
                <TableRow key={application.id}>
                  <TableCell className="font-medium">{application.title}</TableCell>
                  <TableCell>{application.category}</TableCell>
                  <TableCell>{formatAmount(application.amount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={application.status} />
                  </TableCell>
                  <TableCell>{formatDateTime(application.updatedAt)}</TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/applications/${application.id}`}>View details</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader className="space-y-4">
        <div className="space-y-2">
          <CardTitle>Reviewer Queue</CardTitle>
          <CardDescription>
            Review submitted applications and move them through the workflow.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Queue status filter">
          {reviewerQueueFilters.map((filter) => (
            <Button
              key={filter}
              type="button"
              size="sm"
              variant={selectedFilter === filter ? 'default' : 'outline'}
              onClick={() => handleFilterChange(filter)}
            >
              {filter === 'all' ? 'All' : filter}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <StateCard description="Loading reviewer queue…" /> : null}
        {!loading && error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <StateCard
            title="No applications in this queue"
            description="Try another filter or check back later."
          />
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell>
                    <div>{item.owner.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.owner.email}
                    </div>
                  </TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{formatAmount(item.amount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>{formatDateTime(item.updatedAt)}</TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/applications/${item.id}`}>View details</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <CardTitle>
            {mode === 'create' ? 'New Application' : 'Edit Application'}
          </CardTitle>
          <CardDescription>
            Complete the application fields and save your draft before submission.
          </CardDescription>
        </div>
        <Button asChild variant="outline">
          <Link to="/my-applications">Back to list</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <StateCard description="Loading application…" /> : null}
        {!loading && error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!loading ? (
          <form className="space-y-4" onSubmit={handleSave} noValidate>
            <FormField label="Title" error={validationErrors.title} htmlFor="title">
              <Input
                id="title"
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
                className={nativeSelectClassName}
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
              <Textarea
                id="description"
                rows={6}
                value={values.description}
                onChange={(event) => updateValue('description', event.target.value)}
              />
            </FormField>

            <FormField label="Amount" error={validationErrors.amount} htmlFor="amount">
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={values.amount}
                onChange={(event) => updateValue('amount', event.target.value)}
              />
            </FormField>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : mode === 'create' ? 'Create draft' : 'Save changes'}
              </Button>

              {mode === 'edit' && isDraft ? (
                <Button
                  variant="outline"
                  type="button"
                  disabled={submitLoading}
                  onClick={handleSubmitApplication}
                >
                  {submitLoading ? 'Submitting…' : 'Submit application'}
                </Button>
              ) : null}
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
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
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle>Application Detail</CardTitle>
            <CardDescription>
              Review the application data and its audit trail.
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link to={isReviewer ? '/reviewer/queue' : '/my-applications'}>
              Back to list
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <StateCard description="Loading application…" /> : null}
          {!loading && error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {!loading && successMessage ? (
            <Alert variant="success">
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          ) : null}

          {!loading && application ? (
            <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
              <Card className="shadow-none">
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <CardTitle>{application.title}</CardTitle>
                    <StatusBadge status={application.status} />
                  </div>
                  <CardDescription>
                    {application.description || 'No description provided.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <dt className={detailLabelClassName}>Category</dt>
                      <dd className={detailValueClassName}>{application.category}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className={detailLabelClassName}>Amount</dt>
                      <dd className={detailValueClassName}>
                        {formatAmount(application.amount)}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className={detailLabelClassName}>Created</dt>
                      <dd className={detailValueClassName}>
                        {formatDateTime(application.createdAt)}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className={detailLabelClassName}>Updated</dt>
                      <dd className={detailValueClassName}>
                        {formatDateTime(application.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader className="space-y-2">
                  <CardTitle>Actions</CardTitle>
                  <CardDescription>
                    Available actions depend on your role and the current workflow state.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                    <StateCard description="No actions available for this role." />
                  ) : null}

                  {isApplicant && !isDraft ? (
                    <StateCard description="This application is no longer editable because it is not in draft." />
                  ) : null}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!loading && application ? (
        <Card>
          <CardHeader>
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>
              Chronological workflow history for this application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {application.auditLogs.length === 0 ? (
              <StateCard description="No workflow history yet." />
            ) : (
              <ol className="space-y-3">
                {application.auditLogs.map((log) => (
                  <li
                    key={log.id}
                    className="rounded-lg border border-border bg-muted/40 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <strong>
                        {log.oldStatus} → {log.newStatus}
                      </strong>
                      <span className="text-sm text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {log.actor.name} ({log.actor.email})
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {log.comment?.trim() ? log.comment : 'No comment provided.'}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
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
      <p className="text-sm text-muted-foreground">
        Draft applications can still be edited or submitted.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Draft applications can still be edited or submitted.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to={`/applications/${application.id}/edit`}>Edit application</Link>
        </Button>
        <Button variant="outline" type="button" disabled={submitLoading} onClick={onSubmit}>
          {submitLoading ? 'Submitting…' : 'Submit application'}
        </Button>
      </div>
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
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Reviewer actions are hidden when the current status cannot move further.
      </p>

      {availableActions.length === 0 ? (
        <StateCard description="No reviewer transitions are available." />
      ) : (
        <>
          <FormField label="Comment" error={reviewerErrors.comment} htmlFor="reviewer-comment">
            <Textarea
              id="reviewer-comment"
              rows={4}
              value={reviewerValues.comment}
              onChange={(event) =>
                setReviewerValues({ comment: event.target.value })
              }
              placeholder="Required for reject and return actions."
            />
          </FormField>

          <div className="flex flex-wrap gap-3">
            {availableActions.map((status) => (
              <Button
                key={status}
                variant={status === 'APPROVED' ? 'default' : 'outline'}
                type="button"
                disabled={Boolean(reviewerLoading)}
                onClick={() => onTransition(status)}
              >
                {reviewerLoading === status ? 'Saving…' : reviewerActionLabels[status]}
              </Button>
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
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

function AccessCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function StateCard({
  title,
  description,
}: {
  title?: string;
  description: string;
}) {
  return (
    <Card className="bg-muted/40 shadow-none">
      <CardContent className={cn('space-y-2 p-4', !title && 'space-y-0')}>
        {title ? <h3 className="font-medium">{title}</h3> : null}
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Status }) {
  return <Badge className={statusBadgeClassNames[status]}>{status}</Badge>;
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
        message: payload?.message ?? `Request failed with status ${response.status}.`,
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
