package subproject;

public class DemoSubproject2 {

	public static void main(String[] args) { 
		int k_subproject; 
		
	}
	
	private static DemoSubproject foo = null;
	
	
	//multiple simultaneous callers may see partially initialized objects

 public static DemoSubproject getFoo() {
     if (foo==null) {
         foo = new DemoSubproject();
     }
    return foo;
 }

 public static DemoSubproject getFoot() {
     if (foo==null) {
         foo = new DemoSubproject();
     }
    return foo;
 }
 
}
