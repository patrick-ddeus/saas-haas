// imports e componentes
import React, { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { UIErrorBoundary } from '@/lib/error-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  BarChart3,
  Clock,
  TrendingUp,
  AlertTriangle,
  Grid3X3,
  List
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProjectForm } from '@/components/Projects/ProjectForm';
import { ProjectKanban } from '@/components/Projects/ProjectKanban';
import { ProjectViewDialog } from '@/components/Projects/ProjectViewDialog';
import { Project as ProjectType, useProjects } from '@/hooks/useProjects';
import { ProjectStage, ProjectStatus } from '@/types/projects';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '../components/ui/pagination';

// Helper para mapear Project do hook para tipos do frontend
interface Project extends ProjectType {
  attachments?: any[];
}

interface ProjectCompactViewProps {
  projects: Project[];
  onEditProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onViewProject: (project: Project) => void;
  stageNames: Record<ProjectStatus, string>;
}

function ProjectCompactView({
  projects,
  onEditProject,
  onDeleteProject,
  onViewProject,
  stageNames
}: ProjectCompactViewProps) {
  const formatCurrency = (value: number, currency: 'BRL' | 'USD' | 'EUR' = 'BRL') => {
    return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : currency === 'EUR' ? 'de-DE' : 'pt-BR', {
      style: 'currency',
      currency
    }).format(value || 0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'contacted':
        return 'bg-blue-100 text-blue-800';
      case 'proposal':
        return 'bg-yellow-100 text-yellow-800';
      case 'won':
        return 'bg-green-100 text-green-800';
      case 'lost':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'contacted':
        return stageNames.contacted;
      case 'proposal':
        return stageNames.proposal;
      case 'won':
        return stageNames.won;
      case 'lost':
        return stageNames.lost;
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <Card key={project.id} className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">{project.title}</h3>
                <p className="text-sm text-muted-foreground">{project.clientName}</p>
              </div>
              <div className="flex items-center space-x-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onViewProject(project)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Detalhes
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEditProject(project)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDeleteProject(project.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Orçamento:</span>
                <span className="font-medium">{formatCurrency(project.budget || 0, project.currency || 'BRL')}</span>
              </div>

              <div className="flex items-center justify-between">
                <Badge className={getStatusColor(project.status)}>
                  {getStatusLabel(project.status)}
                </Badge>
                <Badge className={getPriorityColor(project.priority)}>
                  {project.priority === 'high' ? 'Alta' : project.priority === 'medium' ? 'Média' : 'Baixa'}
                </Badge>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-2" />
              </div>

              {project.dueDate && (
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  Vencimento: {new Date(project.dueDate).toLocaleDateString('pt-BR')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {projects.length === 0 && (
        <div className="col-span-3 text-center py-8 text-muted-foreground">
          Nenhum projeto encontrado com os filtros aplicados.
          <div className="mt-3">
            <span className="text-xs">Tente limpar os filtros.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectsContent() {
  const { user } = useAuth();
  const { projects, stats, isLoading, error, loadProjects, createProject, updateProject, deleteProject } = useProjects();

  const [ activeTab, setActiveTab ] = useState('kanban');
  const [ showProjectForm, setShowProjectForm ] = useState(false);
  const [ showProjectView, setShowProjectView ] = useState(false);
  const [ editingProject, setEditingProject ] = useState<Project | undefined>();
  console.log("🚀 ~ ProjectsContent ~ editingProject:", editingProject)
  const [ viewingProject, setViewingProject ] = useState<Project | null>(null);
  const [ searchTerm, setSearchTerm ] = useState('');
  const [ statusFilter, setStatusFilter ] = useState<string>('all');
  const [ priorityFilter, setPriorityFilter ] = useState<string>('all');
  const [ viewMode, setViewMode ] = useState<'kanban' | 'compact'>('kanban');

  // Paginação para a lista compacta
  const [ listPage, setListPage ] = useState(1);
  const COMPACT_LIMIT = 9;
  const [ pagination, setPagination ] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  } | null>(null);

  // Filtros avançados por tags (múltiplas)
  const [ tagsInput, setTagsInput ] = useState('');
  const [ tagsFilter, setTagsFilter ] = useState<string[]>([]);

  // Editor de nomes das etapas (persistência por tenant)
  const [ showEditStages, setShowEditStages ] = useState(false);
  const defaultStageNames = {
    contacted: 'Em Contato',
    proposal: 'Com Proposta',
    won: 'Concluído',
    lost: 'Perdido',
  };
  const [ stageNames, setStageNames ] = useState<Record<ProjectStatus, string>>(defaultStageNames as Record<ProjectStatus, string>);
  console.log("🚀 ~ ProjectsContent ~ stageNames:", stageNames)
  const stagePrefsKey = user?.tenantId ? `project_stages_names:${user.tenantId}` : `project_stages_names:default`;

  // Rascunho para edição dentro do modal (evita aplicar antes de salvar)
  const [ stageDraft, setStageDraft ] = useState<Record<ProjectStatus, string>>(stageNames);

  const loadStagePreferences = () => {
    try {
      const raw = localStorage.getItem(stagePrefsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const merged = { ...defaultStageNames, ...parsed };
        setStageNames(merged);
      } else {
        setStageNames(defaultStageNames);
      }
    } catch {
      setStageNames(defaultStageNames);
    }
  };

  const saveStagePreferences = () => {
    // Normaliza entradas vazias para os defaults
    const normalized = {
      contacted: (stageDraft.contacted || '').trim() || defaultStageNames.contacted,
      proposal: (stageDraft.proposal || '').trim() || defaultStageNames.proposal,
      won: (stageDraft.won || '').trim() || defaultStageNames.won,
      lost: (stageDraft.lost || '').trim() || defaultStageNames.lost,
    } as Record<ProjectStatus, string>;

    try {
      localStorage.setItem(stagePrefsKey, JSON.stringify(normalized));
      setStageNames(normalized);
      toast({ title: 'Etapas salvas', description: 'Nomes das etapas atualizados.' });
      setShowEditStages(false);
    } catch (e) {
      toast({ title: 'Erro ao salvar etapas', description: 'Tente novamente.', variant: 'destructive' });
    }
  };

  useEffect(() => {
    loadStagePreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ user?.tenantId ]);

  // Ao abrir o modal, sincroniza o rascunho com os nomes atuais
  useEffect(() => {
    if (showEditStages) {
      setStageDraft(stageNames);
    }
  }, [ showEditStages, stageNames ]);

  // Carrega projetos do backend conforme filtros
  useEffect(() => {
    const params: any = {};
    if (searchTerm) params.search = searchTerm;
    if (statusFilter !== 'all') params.status = statusFilter;
    if (priorityFilter !== 'all') params.priority = priorityFilter;
    if (tagsFilter.length > 0) params.tags = tagsFilter; // URLSearchParams => "a,b"

    loadProjects(params).catch(() => { });
  }, [ searchTerm, statusFilter, priorityFilter, tagsFilter ]);

  // Estágios do Kanban (usam dados já filtrados no backend)
  const projectStages: ProjectStage[] = [
    {
      id: 'contacted',
      name: stageNames.contacted,
      color: 'blue',
      // @ts-expect-error expected
      projects: projects.filter(project => project.status === 'contacted'),
    },
    {
      id: 'proposal',
      name: stageNames.proposal,
      color: 'yellow',
      // @ts-expect-error expected
      projects: projects.filter(project => project.status === 'proposal'),
    },
    {
      id: 'won',
      name: stageNames.won,
      color: 'green',
      // @ts-expect-error expected
      projects: projects.filter(project => project.status === 'won'),
    },
    {
      id: 'lost',
      name: stageNames.lost,
      color: 'red',
      // @ts-expect-error expected
      projects: projects.filter(project => project.status === 'lost'),
    },
  ];

  const handleSubmitProject = async (data: any) => {
    try {
      if (editingProject) {
        await updateProject(editingProject.id, data);
        toast({
          title: 'Projeto atualizado',
          description: 'O projeto foi atualizado com sucesso.',
        });
      } else {
        await createProject(data);
        toast({
          title: 'Projeto criado',
          description: 'O novo projeto foi criado com sucesso.',
        });
      }
      setShowProjectForm(false);
      setEditingProject(undefined);
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao salvar projeto',
        variant: 'destructive',
      });
    }
  };

  const handleAddProject = (status: ProjectStatus) => {
    setEditingProject(undefined);
    setShowProjectForm(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setShowProjectForm(true);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este projeto?')) {
      try {
        await deleteProject(projectId);
        toast({
          title: 'Projeto excluído',
          description: 'O projeto foi excluído com sucesso.',
        });
      } catch (error) {
        toast({
          title: 'Erro',
          description: error instanceof Error ? error.message : 'Erro ao excluir projeto',
          variant: 'destructive',
        });
      }
    }
  };

  const handleMoveProject = async (projectId: string, newStatus: ProjectStatus) => {
    try {
      await updateProject(projectId, { status: newStatus });
      toast({
        title: 'Status atualizado',
        description: 'O status do projeto foi atualizado com sucesso.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao atualizar status',
        variant: 'destructive',
      });
    }
  };

  const handleViewProject = (project: Project) => {
    setViewingProject(project);
    setShowProjectView(true);
  };

  const handleEditFromView = (project: Project) => {
    setEditingProject(project);
    setShowProjectView(false);
    setShowProjectForm(true);
  };

  // Toolbar helpers
  const applyTagsFilter = () => {
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    setTagsFilter(tags);
  };
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setTagsInput('');
    setTagsFilter([]);
    setListPage(1);
  };

  // Use stats from backend
  const totalProjects = stats?.total || 0;
  const avgProgress = stats?.avgProgress || 0;
  const overdueProjects = stats?.overdue || 0;
  const totalRevenue = stats?.revenue || 0;
  const activeProjects = (stats?.byStatus.contacted || 0) + (stats?.byStatus.proposal || 0);

  const getPages = (current: number, total: number) => {
    const pages: number[] = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (current > 3) pages.push(-1); // ellipsis
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push(-2); // ellipsis
    pages.push(total);
    return pages;
  };

  useEffect(() => {
    const params: any = {};
    if (searchTerm) params.search = searchTerm;
    if (statusFilter !== 'all') params.status = statusFilter;
    if (priorityFilter !== 'all') params.priority = priorityFilter;
    if (tagsFilter.length > 0) params.tags = tagsFilter;

    if (viewMode === 'compact') {
      params.page = listPage;
      params.limit = COMPACT_LIMIT;
    }

    loadProjects(params)
      .then((res) => {
        if (res && res.pagination) {
          setPagination(res.pagination);
        } else {
          setPagination(null);
        }
      })
      .catch(() => { });
  }, [ searchTerm, statusFilter, priorityFilter, tagsFilter, viewMode, listPage ]);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Projetos</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projetos</h1>
            <p className="text-muted-foreground">
              Gerenciamento de projetos jurídicos com sistema Kanban
            </p>
          </div>
          <div className="flex space-x-2">
            <div className="flex border rounded-lg p-1">
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('kanban')}
              >
                <Grid3X3 className="h-4 w-4 mr-1" />
                Kanban
              </Button>
              <Button
                variant={viewMode === 'compact' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('compact')}
              >
                <List className="h-4 w-4 mr-1" />
                Lista
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowEditStages(true)}>
              Editar Etapas
            </Button>
            <Button onClick={() => handleAddProject('contacted')}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Projeto
            </Button>
          </div>
        </div>

        {/* Metrics Cards - Usando stats reais do backend */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[ 1, 2, 3, 4 ].map(i => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Projetos</CardTitle>
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalProjects}</div>
                <p className="text-xs text-muted-foreground">
                  {activeProjects} ativos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Progresso Médio</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgProgress}%</div>
                <p className="text-xs text-muted-foreground">
                  Projetos ativos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Projetos Vencidos</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{overdueProjects}</div>
                <p className="text-xs text-muted-foreground">
                  Necessitam atenção
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita Realizada</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(totalRevenue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Projetos concluídos
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar projetos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="contacted">{stageNames.contacted}</SelectItem>
              <SelectItem value="proposal">{stageNames.proposal}</SelectItem>
              <SelectItem value="won">{stageNames.won}</SelectItem>
              <SelectItem value="lost">{stageNames.lost}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Prioridades</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Tags (separe por vírgula)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-[240px]"
            />
            <Button variant="secondary" onClick={applyTagsFilter}>
              <Filter className="h-4 w-4 mr-2" />
              Aplicar
            </Button>
            <Button variant="ghost" onClick={clearFilters}>
              Limpar
            </Button>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-600 font-medium">Erro ao carregar projetos</p>
                  <p className="text-sm text-red-600/80">{error}</p>
                </div>
                <Button onClick={() => loadProjects().catch(() => { })}>Tentar novamente</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[ ...Array(6) ].map((_, idx) => (
              <Card key={idx}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-10" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <p className="mb-2">Nenhum projeto encontrado com os filtros atuais.</p>
              <Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>
            </CardContent>
          </Card>
        ) : viewMode === 'kanban' ? (
          <UIErrorBoundary>
            <ProjectKanban
              stages={projectStages}
              onAddProject={handleAddProject}
              // @ts-expect-error expected
              onEditProject={handleEditProject}
              onDeleteProject={handleDeleteProject}
              onMoveProject={handleMoveProject}
              // @ts-expect-error expected
              onViewProject={handleViewProject}
            />
          </UIErrorBoundary>
        ) : (
          <UIErrorBoundary>
            <ProjectCompactView
              projects={projects}
              onEditProject={handleEditProject}
              onDeleteProject={handleDeleteProject}
              onViewProject={handleViewProject}
              stageNames={stageNames}
            />
            {/* Paginação para a listagem compacta */}
            {pagination && pagination.totalPages > 1 && (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (pagination.hasPrev) setListPage((p) => Math.max(1, p - 1));
                      }}
                    />
                  </PaginationItem>
                  {getPages(pagination.page, pagination.totalPages).map((p, idx) => (
                    <PaginationItem key={`${p}-${idx}`}>
                      {p < 0 ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          href="#"
                          isActive={p === pagination.page}
                          onClick={(e) => {
                            e.preventDefault();
                            setListPage(p);
                          }}
                        >
                          {p}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (pagination.hasNext) setListPage((p) => Math.min(pagination.totalPages, p + 1));
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </UIErrorBoundary>
        )}

        {/* Project Form Dialog */}
        <ProjectForm
          open={showProjectForm}
          onOpenChange={setShowProjectForm}
          onSubmit={handleSubmitProject}
          isEditing={!!editingProject}
          project={!!editingProject ? editingProject : undefined}
        />

        {/* Project View Dialog */}
        {viewingProject && (
          <ProjectViewDialog
            open={showProjectView}
            onOpenChange={setShowProjectView}
            // @ts-expect-error expected
            project={viewingProject}
            // @ts-expect-error expected
            onEdit={handleEditFromView}
            onDelete={handleDeleteProject}
          />
        )}

        {/* Editor de nomes das etapas */}
        <Dialog open={showEditStages} onOpenChange={setShowEditStages}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar nomes das etapas</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm">Em Contato</label>
                  <Input value={stageNames.contacted} onChange={(e) => setStageNames(prev => ({ ...prev, contacted: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm">Com Proposta</label>
                  <Input value={stageNames.proposal} onChange={(e) => setStageNames(prev => ({ ...prev, proposal: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm">Concluído</label>
                  <Input value={stageNames.won} onChange={(e) => setStageNames(prev => ({ ...prev, won: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm">Perdido</label>
                  <Input value={stageNames.lost} onChange={(e) => setStageNames(prev => ({ ...prev, lost: e.target.value }))} />
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setShowEditStages(false)}>Cancelar</Button>
              <Button onClick={saveStagePreferences}>Salvar alterações</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

export function Projects() {
  return (
    <UIErrorBoundary>
      <ProjectsContent />
    </UIErrorBoundary>
  );
}
