
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ArticleCardProps {
  article: {
    id: string;
    title: string;
    content: string;
    category: string;
    tags?: string[];
    view_count: number;
  };
  variant?: "default" | "compact" | "featured";
  onClick?: () => void;
}

export function ArticleCard({ article, variant = "default", onClick }: ArticleCardProps) {
  const cardClasses = {
    default: "hover:shadow-md transition-shadow cursor-pointer",
    compact: "hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary/50",
    featured: "hover:shadow-lg transition-all cursor-pointer border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent"
  };

  return (
    <Card className={cardClasses[variant]} onClick={onClick}>
      <CardHeader className={variant === "compact" ? "pb-3" : undefined}>
        <CardTitle className={variant === "compact" ? "text-base line-clamp-2" : "text-lg line-clamp-2"}>
          {article.title}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={variant === "featured" ? "default" : "secondary"} className="text-xs">
            {article.category}
          </Badge>
          <span className="text-xs text-muted-foreground">{article.view_count} views</span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {article.content}
        </p>
        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {article.tags.slice(0, variant === "compact" ? 2 : 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
