import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export default function NotFound() {
  const { t } = useLanguage();

  return (
    <div className="w-full flex items-center justify-center py-16 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-bold text-foreground">
              404 — {t("pageNotFound")}
            </h1>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            {t("pageNotFoundDesc")}
          </p>

          <Link href="/" className="inline-block mt-6">
            <Button variant="outline">{t("backHome")}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
