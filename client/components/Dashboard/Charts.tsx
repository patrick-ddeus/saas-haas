import React from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * RECHARTS COMPONENT WRAPPERS
 * ============================
 *
 * Custom wrappers for XAxis and YAxis to avoid defaultProps warnings
 * while maintaining full functionality.
 */

const CustomXAxis = ({
  dataKey,
  stroke = "#6B7280",
  tick = { fontSize: 12, fill: "#6B7280" },
  height = 60,
  angle,
  textAnchor,
  ...props
}: any) => (
  <XAxis
    dataKey={dataKey}
    stroke={stroke}
    tick={tick}
    height={height}
    angle={angle}
    textAnchor={textAnchor}
    {...props}
  />
);

const CustomYAxis = ({
  stroke = "#6B7280",
  tick = { fontSize: 12, fill: "#6B7280" },
  width = 60,
  tickFormatter,
  ...props
}: any) => (
  <YAxis
    stroke={stroke}
    tick={tick}
    width={width}
    tickFormatter={tickFormatter}
    {...props}
  />
);

/**
 * INTERFACES PARA DADOS DOS GRÁFICOS
 * ===================================
 */

interface CategoryData {
  categoryId: string;
  category: string;
  amount: number;
  count: number;
}

interface CashFlowData {
  day: string;
  income: number;
  expense: number;
  net: number;
}

interface ProjectData {
  status: string;
  count: number;
  totalBudget: number;
}

interface ChartDataProps {
  financial?: {
    cashFlow: CashFlowData[];
    categories: {
      income: CategoryData[];
      expense: CategoryData[];
    };
  };
  projects?: ProjectData[];
  tasks?: any[];
}

interface ChartsProps {
  className?: string;
  chartData: ChartDataProps;
}

/**
 * PALETAS DE CORES
 * ================
 */
const COLORS_INCOME = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#6B7280"];
const COLORS_EXPENSE = ["#EF4444", "#F97316", "#84CC16", "#06B6D4", "#EC4899", "#6B7280"];
const COLORS_PROJECTS = ["#3B82F6", "#F59E0B", "#10B981", "#EF4444"];

export function DashboardCharts({ className = '', chartData }: ChartsProps) {
  console.log('📊 DashboardCharts rendered with data:', {
    hasFinancial: !!chartData?.financial,
    hasProjects: !!chartData?.projects,
    hasTasks: !!chartData?.tasks,
    financialCashFlowLength: chartData?.financial?.cashFlow?.length || 0,
    incomeCategories: chartData?.financial?.categories?.income?.length || 0,
    expenseCategories: chartData?.financial?.categories?.expense?.length || 0
  });
  /**
   * HELPER: Formatação de moeda
   */
  const formatCurrency = (value: number) => {
    try {
      if (typeof value !== 'number' || isNaN(value)) {
        return 'R$ 0';
      }
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    } catch (err) {
      console.error('Error formatting currency:', err);
      return 'R$ 0';
    }
  };

  /**
   * HELPER: Tooltip customizado
   */
  const CustomTooltip = ({ active, payload, label }: any) => {
    try {
      if (active && payload && Array.isArray(payload) && payload.length > 0) {
        return (
          <div className="bg-background border border-border rounded-lg shadow-lg p-3">
            <p className="font-medium">{label || 'Dados'}</p>
            {payload.map((entry: any, index: number) => {
              if (!entry || typeof entry.value === 'undefined') return null;
              
              return (
                <p key={index} style={{ color: entry.color || '#000' }} className="text-sm">
                  {entry.name || 'Valor'}:{" "}
                  {entry.name && (entry.name.includes("Receitas") ||
                  entry.name.includes("Despesas") ||
                  entry.name.includes("Saldo"))
                    ? formatCurrency(entry.value)
                    : `${entry.value}`}
                </p>
              );
            })}
          </div>
        );
      }
      return null;
    } catch (err) {
      console.error('Error rendering tooltip:', err);
      return null;
    }
  };

  /**
   * HELPER: Labels customizados para gráficos de pizza
   */
  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    if (percent < 0.05) return null;

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // ✅ VALIDAÇÃO ROBUSTA - SEMPRE RENDERIZA, MESMO SEM DADOS
  if (!chartData || typeof chartData !== 'object') {
    console.warn('Invalid chartData provided to DashboardCharts:', chartData);
    chartData = { financial: null, projects: [], tasks: [] };
  }

  // ✅ Garantir estrutura mínima
  const safeChartData = {
    financial: chartData.financial || null,
    projects: Array.isArray(chartData.projects) ? chartData.projects : [],
    tasks: Array.isArray(chartData.tasks) ? chartData.tasks : []
  };

  /**
   * TRANSFORMAÇÃO 1: Evolução Financeira (Cash Flow)
   * =================================================
   */
  const financialEvolutionData = (safeChartData.financial?.cashFlow ?? []).map(item => ({
    day: new Date(item.day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    receitas: item.income || 0,
    despesas: item.expense || 0,
    saldo: item.net || 0,
  }));

  /**
   * TRANSFORMAÇÃO 2: Receitas por Categoria (Simplificado)
   * ======================================================
   */
  const revenueByCategory = (safeChartData.financial?.categories?.income ?? []).map((item, index) => ({
    name: item.category || 'Sem categoria',
    value: item.amount || 0,
    color: COLORS_INCOME[index % COLORS_INCOME.length],
  }));

  /**
   * TRANSFORMAÇÃO 3: Despesas por Categoria (Simplificado)
   * =======================================================
   */
  const expensesByCategory = (safeChartData.financial?.categories?.expense ?? []).map((item, index) => ({
    name: item.category || 'Sem categoria',
    value: item.amount || 0,
    color: COLORS_EXPENSE[index % COLORS_EXPENSE.length],
  }));

  /**
   * TRANSFORMAÇÃO 4: Projetos por Status
   * =====================================
   */
  const projectsByStatus = (safeChartData.projects ?? []).map((item, index) => ({
    status: item.status || 'Sem status',
    count: item.count || 0,
    color: COLORS_PROJECTS[index % COLORS_PROJECTS.length],
  }));

  return (
    <div className={`grid gap-4 md:grid-cols-2 ${className}`}>
      {/* Evolução Financeira (Últimos 30 dias) */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Evolução Financeira (Últimos 30 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {financialEvolutionData && financialEvolutionData.length > 0 ? (
              <LineChart data={financialEvolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <CustomXAxis dataKey="day" />
                <CustomYAxis tickFormatter={formatCurrency} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="receitas"
                  name="Receitas"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={{ fill: "#10B981", strokeWidth: 2, r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="despesas"
                  name="Despesas"
                  stroke="#EF4444"
                  strokeWidth={3}
                  dot={{ fill: "#EF4444", strokeWidth: 2, r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="saldo"
                  name="Saldo"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  dot={{ fill: "#3B82F6", strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-muted-foreground">
                  Nenhum dado financeiro para exibir no período.
                </span>
              </div>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Receitas por Categoria */}
      <Card>
        <CardHeader>
          <CardTitle>Receitas por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {revenueByCategory.length > 0 ? (
              <PieChart>
                <Pie
                  data={revenueByCategory}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {revenueByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Valor']}
                />
              </PieChart>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-muted-foreground">
                  Nenhuma receita registrada.
                </span>
              </div>
            )}
          </ResponsiveContainer>
          {revenueByCategory.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-2">
              {revenueByCategory.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Despesas por Categoria */}
      <Card>
        <CardHeader>
          <CardTitle>Despesas por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {expensesByCategory.length > 0 ? (
              <PieChart>
                <Pie
                  data={expensesByCategory}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {expensesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Valor']}
                />
              </PieChart>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-muted-foreground">
                  Nenhuma despesa registrada.
                </span>
              </div>
            )}
          </ResponsiveContainer>
          {expensesByCategory.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-2">
              {expensesByCategory.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projetos por Status */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Projetos Por Status</CardTitle>
        </CardHeader>
        <CardContent>
          {projectsByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={projectsByStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <CustomXAxis
                  dataKey="status"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <CustomYAxis />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Projetos" radius={[4, 4, 0, 0]}>
                  {projectsByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Nenhum projeto encontrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
