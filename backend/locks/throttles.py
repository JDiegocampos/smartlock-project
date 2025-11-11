from rest_framework.throttling import SimpleRateThrottle

class ValidatePinThrottle(SimpleRateThrottle):
    scope = 'validate_pin'

    def get_cache_key(self, request, view):
        # Throttle by device API key if available, otherwise by IP
        api_key = request.headers.get('X-API-KEY') or request.META.get('HTTP_X_API_KEY')
        if api_key:
            return self.cache_format % {
                'scope': self.scope,
                'ident': api_key
            }
        # fallback to IP
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }
