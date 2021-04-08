package javacodechecker;

public class SettingJavaBeanProperties {

	public void method() {
		Company bean = new Company();
		HashMap map = new HashMap();
		Enumeration names = request.getParameterNames();
		while (names.hasMoreElements()) {
		    String name = (String) names.nextElement();
		    map.put(name, request.getParameterValues(name));
		}
    	// EMB-ISSUE: CodeIssueNames.SETTING_JAVA_BEAN_PROPERTIES
		BeanUtils.populate(bean, map); // Sensitive
	}
}
