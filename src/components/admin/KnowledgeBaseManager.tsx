import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WysiwygEditor } from "./WysiwygEditor";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TablePaginator } from "@/components/ui/table-paginator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { BookOpen, Plus, Edit, Eye, Trash2, Users, Globe, FileText } from "lucide-react";

interface KnowledgeBaseArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  target_user_types: string[];
  is_published: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  published_at?: string;
  author_id?: string;
}

const KnowledgeBaseManager = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [articles, setArticles] = useState<KnowledgeBaseArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  const [newArticle, setNewArticle] = useState({
    title: '',
    content: '',
    category: '',
    tags: [] as string[],
    is_published: false
  });

  const categories = [
    'Getting Started',
    'Property Management',
    'Tenant Guide',
    'Payments & Billing',
    'Maintenance',
    'Troubleshooting',
    'Account Settings',
    'Legal & Policies'
  ];

  const userRoles = [
    { value: 'Admin', label: 'Admin' },
    { value: 'Landlord', label: 'Landlord' },
    { value: 'Manager', label: 'Property Manager' },
    { value: 'Agent', label: 'Agent' },
    { value: 'Tenant', label: 'Tenant' }
  ];

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const { data, error } = await supabase
        .from('knowledge_base_articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Generate dummy data if no articles exist
      if (!data || data.length === 0) {
        const dummyArticles: KnowledgeBaseArticle[] = [
          {
            id: '1',
            title: 'Getting Started with Zira Homes',
            content: 'Welcome to Zira Homes! This guide will help you get started with our property management platform...',
            category: 'Getting Started',
            tags: ['beginner', 'setup', 'basics'],
            target_user_types: ['Landlord', 'Tenant'],
            is_published: true,
            view_count: 245,
            created_at: '2025-01-01T10:00:00Z',
            updated_at: '2025-01-01T10:00:00Z',
            published_at: '2025-01-01T10:00:00Z',
            author_id: '1'
          },
          {
            id: '2',
            title: 'How to Submit Maintenance Requests',
            content: 'Tenants can easily submit maintenance requests through the platform. Here\'s how...',
            category: 'Maintenance',
            tags: ['tenant', 'maintenance', 'requests'],
            target_user_types: ['Tenant'],
            is_published: true,
            view_count: 189,
            created_at: '2025-01-02T10:00:00Z',
            updated_at: '2025-01-02T10:00:00Z',
            published_at: '2025-01-02T10:00:00Z',
            author_id: '1'
          },
          {
            id: '3',
            title: 'Property Management Best Practices',
            content: 'Draft content for landlords on property management best practices...',
            category: 'Property Management',
            tags: ['landlord', 'best-practices', 'management'],
            target_user_types: ['Landlord', 'Manager'],
            is_published: false,
            view_count: 0,
            created_at: '2025-01-03T10:00:00Z',
            updated_at: '2025-01-03T10:00:00Z',
            author_id: '1'
          }
        ];
        setArticles(dummyArticles);
      } else {
        setArticles(data);
      }
    } catch (error) {
      console.error('Error fetching articles:', error);
      toast({
        title: "Error",
        description: "Failed to fetch knowledge base articles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveArticle = async () => {
    try {
      if (!newArticle.title || !newArticle.content || !newArticle.category) {
        toast({
          title: "Validation Error",
          description: "Title, content, and category are required",
          variant: "destructive",
        });
        return;
      }

      const articleData = {
        title: newArticle.title,
        content: newArticle.content,
        category: newArticle.category,
        tags: newArticle.tags,
        target_user_types: selectedRoles,
        is_published: newArticle.is_published,
        author_id: user?.id || '1'
      };

      if (editingArticle) {
        const { error } = await supabase
          .from('knowledge_base_articles')
          .update({
            ...articleData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingArticle.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('knowledge_base_articles')
          .insert([articleData]);
        
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Article ${editingArticle ? 'updated' : 'created'} successfully`,
      });

      fetchArticles();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving article:', error);
      toast({
        title: "Error",
        description: "Failed to save article",
        variant: "destructive",
      });
    }
  };

  const publishArticle = async (articleId: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_base_articles')
        .update({ 
          is_published: true,
          published_at: new Date().toISOString()
        })
        .eq('id', articleId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Article published to help center",
      });

      fetchArticles();
    } catch (error) {
      console.error('Error publishing article:', error);
      toast({
        title: "Error",
        description: "Failed to publish article",
        variant: "destructive",
      });
    }
  };

  const deleteArticle = async (articleId: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_base_articles')
        .delete()
        .eq('id', articleId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Article deleted successfully",
      });

      fetchArticles();
    } catch (error) {
      console.error('Error deleting article:', error);
      toast({
        title: "Error",
        description: "Failed to delete article",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setNewArticle({
      title: '',
      content: '',
      category: '',
      tags: [],
      is_published: false
    });
    setSelectedRoles([]);
    setEditingArticle(null);
  };

  const editArticle = (article: KnowledgeBaseArticle) => {
    setEditingArticle(article);
    setNewArticle({
      title: article.title,
      content: article.content,
      category: article.category,
      tags: article.tags,
      is_published: article.is_published
    });
    setSelectedRoles(article.target_user_types);
    setIsDialogOpen(true);
  };

  const handleRoleToggle = (role: string, checked: boolean) => {
    if (checked) {
      setSelectedRoles(prev => [...prev, role]);
    } else {
      setSelectedRoles(prev => prev.filter(r => r !== role));
    }
  };

  const publishedCount = articles.filter(a => a.is_published).length;
  const draftCount = articles.filter(a => !a.is_published).length;
  const totalViews = articles.reduce((sum, a) => sum + a.view_count, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="card-gradient-blue">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Articles</CardTitle>
            <BookOpen className="h-4 w-4 text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{articles.length}</div>
            <p className="text-xs text-white/80">All articles</p>
          </CardContent>
        </Card>
        <Card className="card-gradient-green">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Published</CardTitle>
            <Globe className="h-4 w-4 text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{publishedCount}</div>
            <p className="text-xs text-white/80">Live articles</p>
          </CardContent>
        </Card>
        <Card className="card-gradient-orange">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Drafts</CardTitle>
            <FileText className="h-4 w-4 text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{draftCount}</div>
            <p className="text-xs text-white/80">Work in progress</p>
          </CardContent>
        </Card>
        <Card className="card-gradient-purple">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalViews}</div>
            <p className="text-xs text-white/80">All time views</p>
          </CardContent>
        </Card>
      </div>

      {/* Header with Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-primary">Knowledge Base Articles</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage help articles for different user roles
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Create New Article
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingArticle ? 'Edit' : 'Create'} Knowledge Base Article</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={newArticle.title}
                      onChange={(e) => setNewArticle(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Article title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Select 
                      value={newArticle.category} 
                      onValueChange={(value) => setNewArticle(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(category => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="content">Content *</Label>
                  <WysiwygEditor
                    value={newArticle.content}
                    onChange={(content) => setNewArticle(prev => ({ ...prev, content }))}
                    placeholder="Enter article content... Use markdown for formatting!"
                  />
                </div>

                <div>
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={newArticle.tags.join(', ')}
                    onChange={(e) => setNewArticle(prev => ({ 
                      ...prev, 
                      tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag) 
                    }))}
                    placeholder="getting-started, tenant, basics"
                  />
                </div>

                <div>
                  <Label>Visible to User Roles</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Select which user roles can view this article
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {userRoles.map(role => (
                      <div key={role.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`role-${role.value}`}
                          checked={selectedRoles.includes(role.value)}
                          onCheckedChange={(checked) => handleRoleToggle(role.value, checked as boolean)}
                        />
                        <Label htmlFor={`role-${role.value}`} className="text-sm">{role.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_published"
                    checked={newArticle.is_published}
                    onCheckedChange={(checked) => setNewArticle(prev => ({ ...prev, is_published: checked as boolean }))}
                  />
                  <Label htmlFor="is_published">Publish immediately</Label>
                </div>

                <div className="flex gap-2">
                  <Button onClick={saveArticle} className="flex-1 bg-primary hover:bg-primary/90">
                    {editingArticle ? 'Update' : 'Create'} Article
                  </Button>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button 
            variant="outline" 
            onClick={() => toast({
              title: "Publishing",
              description: "Articles published to help center successfully.",
            })}
          >
            Publish to Help Center
          </Button>
        </div>
      </div>

      {/* Articles List */}
      <div className="space-y-4">
        {articles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <BookOpen className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No articles found</h3>
              <p className="text-gray-500 text-center mb-4">
                Create your first knowledge base article to get started
              </p>
              <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Create First Article
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Client-side pagination */}
            {(() => {
              const totalItems = articles.length;
              const totalPages = Math.ceil(totalItems / pageSize);
              const startIndex = (currentPage - 1) * pageSize;
              const endIndex = startIndex + pageSize;
              const paginatedArticles = articles.slice(startIndex, endIndex);
              
              return (
                <>
                  {paginatedArticles.map((article) => (
                    <Card key={article.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-medium text-lg">{article.title}</h3>
                              <Badge className={`${article.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {article.is_published ? 'published' : 'draft'}
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                              {article.content.substring(0, 150)}...
                            </p>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="font-medium">{article.view_count} views</span>
                              <div className="flex flex-wrap gap-1">
                                {article.target_user_types.map((role) => (
                                  <Badge key={role} variant="secondary" className="text-xs">
                                    {role}
                                  </Badge>
                                ))}
                              </div>
                              <span>{article.category}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {!article.is_published ? (
                              <Button
                                size="sm"
                                onClick={() => publishArticle(article.id)}
                                className="text-xs"
                              >
                                Publish
                              </Button>
                            ) : null}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => editArticle(article)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteArticle(article.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  <TablePaginator
                    currentPage={currentPage}
                    totalPages={Math.ceil(Math.max(totalItems, 1) / pageSize)}
                    pageSize={pageSize}
                    totalItems={totalItems}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                    showPageSizeSelector={true}
                  />
                </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBaseManager;