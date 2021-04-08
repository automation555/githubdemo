package javacodechecker;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;
import org.springframework.security.web.firewall.HttpFirewall;
import org.springframework.security.web.firewall.StrictHttpFirewall;

@Configuration
@EnableWebSecurity
public class DisabledSpringSecuritysCSRF extends WebSecurityConfigurerAdapter {

	private static final String TEST_ROUTE = "/testroute/";

	@Bean
	protected HttpFirewall strictFirewall() {
		StrictHttpFirewall firewall = new StrictHttpFirewall();
		firewall.setAllowedHttpMethods(Arrays.asList(HttpMethod.GET.name(), HttpMethod.POST.name()));
		return firewall;
	}

	@Override
	protected void configure(HttpSecurity http) throws Exception {
		// EMB-ISSUE:CodeIssueNames.DISABLED_SPRING_SECURITYS_CSRF
		http.authorizeRequests().mvcMatchers(HttpMethod.GET, TEST_ROUTE).permitAll().anyRequest().denyAll().and().csrf()
				.disable();
		http.headers().contentSecurityPolicy("default-src 'self'");
	}

}