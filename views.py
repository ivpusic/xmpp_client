from django.shortcuts import render_to_response
from django.template import RequestContext
from django.views.generic import TemplateView

class ChatView(TemplateView):
    template_name = "chat_page.html"
    def get(self, *args, **kwargs):
        context = {}
        if self.request.user.is_authenticated():
            return self.render_to_response(context)
        else:
            return self.render_to_response(context)

class PageSlideView(TemplateView):
    template_name = "pageslide.html"

