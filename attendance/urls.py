from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('privacy/', views.privacy, name='privacy'),
    path('terms/', views.terms, name='terms'),
    path('login/', views.login_view, name='login'),
    path('attendance/', views.attendance, name='attendance'),
    path('courses/', views.courses, name='courses'),
    path('grades/', views.grades, name='grades'),
    path('timetable/', views.timetable, name='timetable'),
    path('assignments/', views.assignments, name='assignments'),
    path('profile/', views.profile, name='profile'),
    path('course/<int:course_id>/', views.course_detail, name='course_detail'),
    path('logout/', views.logout_view, name='logout'),
]