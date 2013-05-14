from django.conf.urls import patterns, url
from .views import ChatView
from .views import PageSlideView

urlpatterns = patterns("",
                       
    url(r"^$", ChatView.as_view(), name="chat_view"),
    url(r'^pageslide/$', PageSlideView.as_view(), name='pageslide'),
)