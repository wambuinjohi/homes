
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContactSupportButton } from "@/components/support/ContactSupportButton";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Search, BookOpen, Users, Wrench, CreditCard, Settings, Star, Shield, UserCheck, Building, FileText, HelpCircle } from "lucide-react";
import { TablePaginator } from "@/components/ui/table-paginator";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";

interface KnowledgeBaseArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags?: string[];
  target_user_types?: string[];
  view_count: number;
}

const categories = [
  { name: "Getting Started", icon: BookOpen, color: "bg-blue-500" },
  { name: "Account & Roles", icon: UserCheck, color: "bg-purple-500" },
  { name: "Payments & Invoices", icon: CreditCard, color: "bg-green-500" },
  { name: "Maintenance", icon: Wrench, color: "bg-orange-500" },
  { name: "Billing & Subscription", icon: Building, color: "bg-indigo-500" },
  { name: "General", icon: Settings, color: "bg-gray-500" },
];

export default function KnowledgeBase() {
  console.log("KnowledgeBase component loading...");
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [articles, setArticles] = useState<KnowledgeBaseArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  
  const { page, pageSize, setPage, setPageSize } = useUrlPageParam({
    pageSize: 12,
    defaultPage: 1
  });

  useEffect(() => {
    fetchUserRole();
    fetchArticles();
  }, []);

  const fetchUserRole = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        setUserRole(data.role);
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  };

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('knowledge_base_articles')
        .select('*')
        .eq('is_published', true)
        .order('view_count', { ascending: false });

      if (error) {
        console.error('Error fetching articles:', error);
        setArticles([]);
      } else {
        setArticles(data || []);
      }
    } catch (error) {
      console.error('Error fetching articles:', error);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         article.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         article.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = !selectedCategory || article.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredArticles.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedArticles = filteredArticles.slice(startIndex, startIndex + pageSize);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategory, setPage]);

  const popularArticles = articles.sort((a, b) => b.view_count - a.view_count).slice(0, 3);
  
  // Get role-specific articles
  const roleSpecificArticles = articles.filter(article => 
    article.target_user_types?.includes(userRole) || 
    article.target_user_types?.includes('Admin') ||
    article.target_user_types?.includes('Landlord') ||
    article.target_user_types?.includes('Manager') ||
    article.target_user_types?.includes('Agent') ||
    article.target_user_types?.includes('Tenant')
  ).slice(0, 4);

  // Check if we're in tenant context
  const isTenantRoute = window.location.pathname.startsWith('/tenant');
  
  const content = (
    <div className="container mx-auto p-6 space-y-8">
      {/* Branded Header */}
      <div className="text-center space-y-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-lg p-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <HelpCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Help Center
          </h1>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
          Find answers, learn how to use the platform, and get the most out of your property management experience.
        </p>
        
        {/* Search Bar */}
        <div className="relative max-w-lg mx-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12"
          />
        </div>
      </div>

      {!searchQuery && !selectedCategory && (
        <>
          {/* Role-Specific Quick Start */}
          {userRole && roleSpecificArticles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Quick Start for {userRole}s</h2>
                <Badge variant="secondary" className="text-xs">{roleSpecificArticles.length} articles</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {roleSpecificArticles.map((article) => (
                  <Card key={article.id} className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base line-clamp-2">{article.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{article.category}</Badge>
                        <span className="text-xs text-muted-foreground">{article.view_count} views</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {article.content}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Popular Articles */}
          {popularArticles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                <h2 className="text-xl font-semibold">Most Popular</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {popularArticles.map((article) => (
                  <Card key={article.id} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-lg line-clamp-2">{article.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{article.category}</Badge>
                        <span className="text-xs text-muted-foreground">{article.view_count} views</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {article.content}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-3">
                        {article.tags?.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Categories */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Browse by Category</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Button
            variant={selectedCategory === "" ? "default" : "outline"}
            onClick={() => setSelectedCategory("")}
            className="h-20 flex flex-col items-center gap-2"
          >
            <BookOpen className="h-6 w-6" />
            <span className="text-xs">All Articles</span>
          </Button>
          {categories.map((category) => (
            <Button
              key={category.name}
              variant={selectedCategory === category.name ? "default" : "outline"}
              onClick={() => setSelectedCategory(category.name)}
              className="h-20 flex flex-col items-center gap-2"
            >
              <div className={`p-2 rounded-full ${category.color} bg-opacity-10`}>
                <category.icon className="h-4 w-4" />
              </div>
              <span className="text-xs text-center leading-tight">{category.name}</span>
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="text-muted-foreground">Loading articles...</div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {searchQuery || selectedCategory ? "Search Results" : "All Articles"}
            </h2>
            {filteredArticles.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''} found
              </span>
            )}
          </div>
          
          {filteredArticles.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No articles found</h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your search terms or browse different categories.
                </p>
                <ContactSupportButton />
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {paginatedArticles.map((article) => (
                  <Card key={article.id} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-lg line-clamp-2">{article.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{article.category}</Badge>
                        <span className="text-xs text-muted-foreground">{article.view_count} views</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {article.content}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-3">
                        {article.tags?.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <TablePaginator
                currentPage={page}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredArticles.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                showPageSizeSelector={true}
              />
            </>
          )}
        </div>
      )}

      {/* Still need help section */}
      <Card className="bg-muted/50 border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Still need help?
          </CardTitle>
          <CardDescription>
            Can't find what you're looking for? Our support team is here to help.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContactSupportButton variant="default" />
        </CardContent>
      </Card>
    </div>
  );

  // Wrap with appropriate layout based on route
  if (isTenantRoute) {
    return content;
  }

  return (
    <DashboardLayout>
      {content}
    </DashboardLayout>
  );
}
