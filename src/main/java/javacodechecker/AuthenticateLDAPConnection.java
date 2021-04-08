package javacodechecker;

import java.util.Hashtable;

public class AuthenticateLDAPConnection {
	public void method() {
		Hashtable<String, Object> env = new Hashtable<String, Object>();

		// Set up the environment for creating the initial context
		env.put(Context.INITIAL_CONTEXT_FACTORY, "com.sun.jndi.ldap.LdapCtxFactory");
		env.put(Context.PROVIDER_URL, "ldap://localhost:389/o=JNDITutorial");

		// EMB-ISSUE: CodeIssueNames.AUTHENTICATE_LDAP_CONNECTION
		env.put(Context.SECURITY_AUTHENTICATION, "none");
		
	}
}
