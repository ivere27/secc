// man gcc
// /path/to/llvm/tools/clang/docs/CommandGuide/clang.rst
//FIXME : what a sapzil.. Parsing man gcc or just hand-write?

var GCC_OPTIONS = {};

GCC_OPTIONS['Overall Options'] = '\
    -c  -S  -E  -o <file>  -no-canonical-prefixes -pipe  -pass-exit-codes -x <language>  -v  -###  --help[=class[,...]]  --target-help --version\
    -wrapper <@file> -fplugin=<file> -fplugin-arg-<name>=<arg> -fdump-ada-spec[-slim] -fada-spec-parent=<unit> -fdump-go-spec=<file>';

//C 
GCC_OPTIONS['Language Options'] = '\
    -ansi  -std=<standard>  -fgnu89-inline -aux-info <filename> -fallow-parameterless-variadic-functions -fno-asm  -fno-builtin\
    -fno-builtin-<function> -fhosted  -ffreestanding -fopenmp -fopenmp-simd -fms-extensions -fplan9-extensions -traditional\
    -traditional-cpp -fallow-single-precision  -fcond-mismatch -flax-vector-conversions -fsigned-bitfields  -fsigned-char -funsigned-bitfields\
    -funsigned-char';

//C++ 
GCC_OPTIONS['Language Options'] += '\
   -fabi-version=<n>  -fno-access-control  -fcheck-new -fconstexpr-depth=<n>  -ffriend-injection -fno-elide-constructors -fno-enforce-eh-specs\
   -ffor-scope  -fno-for-scope  -fno-gnu-keywords -fno-implicit-templates -fno-implicit-inline-templates -fno-implement-inlines  \
   -fno-nonansi-builtins  -fnothrow-opt  -fno-operator-names -fno-optional-diags  -fpermissive -fno-pretty-templates -frepo  -fno-rtti  -fstats\
   -ftemplate-backtrace-limit=<n> -ftemplate-depth=<n> -fno-threadsafe-statics -fuse-cxa-atexit  -fno-weak  -nostdinc++ -fvisibility-inlines-hidden\
   -fvtable-verify=[std|preinit|none] -fvtv-counts -fvtv-debug -fvisibility-ms-compat -fext-numeric-literals -Wabi  -Wconversion-null\
   -Wctor-dtor-privacy -Wdelete-non-virtual-dtor -Wliteral-suffix -Wnarrowing -Wnoexcept -Wnon-virtual-dtor  -Wreorder -Weffc++\
   -Wstrict-null-sentinel -Wno-non-template-friend  -Wold-style-cast -Woverloaded-virtual  -Wno-pmf-conversions -Wsign-promo';

//Objective-C and Objective-C++ 
GCC_OPTIONS['Language Options'] += '\
   -fconstant-string-class=<class-name> -fgnu-runtime  -fnext-runtime -fno-nil-receivers -fobjc-abi-version=<n> -fobjc-call-cxx-cdtors\
   -fobjc-direct-dispatch -fobjc-exceptions -fobjc-gc -fobjc-nilcheck -fobjc-std=objc1 -freplace-objc-classes -fzero-link -gen-decls\
   -Wassign-intercept -Wno-protocol  -Wselector -Wstrict-selector-match -Wundeclared-selector';

//Independent 
GCC_OPTIONS['Language Options'] +=  '\
   -fmessage-length=<n> -fdiagnostics-show-location=[once|every-line] -fdiagnostics-color=[auto|never|always] -fno-diagnostics-show-option\
   -fno-diagnostics-show-caret';

GCC_OPTIONS['Warning Options'] = '\
   -fsyntax-only  -fmax-errors=<n>  -Wpedantic -pedantic-errors -w  -Wextra  -Wall  -Waddress  -Waggregate-return -Waggressive-loop-optimizations\
   -Warray-bounds -Wno-attributes -Wno-builtin-macro-redefined -Wc++-compat -Wc++11-compat -Wcast-align  -Wcast-qual -Wchar-subscripts\
   -Wclobbered  -Wcomment -Wconditionally-supported -Wconversion -Wcoverage-mismatch -Wdate-time -Wdelete-incomplete -Wno-cpp -Wno-deprecated\
   -Wno-deprecated-declarations -Wdisabled-optimization -Wno-div-by-zero -Wdouble-promotion -Wempty-body  -Wenum-compare -Wno-endif-labels\
   -Werror[=*] -Wfatal-errors  -Wfloat-equal  -Wformat[=2] -Wno-format-contains-nul -Wno-format-extra-args -Wformat-nonliteral\
   -Wformat-security  -Wformat-y2k -Wframe-larger-than=<len> -Wno-free-nonheap-object -Wjump-misses-init -Wignored-qualifiers -Wimplicit\
   -Wimplicit-function-declaration  -Wimplicit-int -Winit-self  -Winline -Wmaybe-uninitialized -Wno-int-to-pointer-cast -Wno-invalid-offsetof\
   -Winvalid-pch -Wlarger-than=<len>  -Wunsafe-loop-optimizations -Wlogical-op -Wlong-long -Wmain -Wmemset-transposed-args\
   -Wmissing-braces -Wmissing-field-initializers -Wmissing-include-dirs -Wno-multichar  -Wnonnull  -Wno-overflow -Wopenmp-simd\
   -Woverlength-strings  -Wpacked  -Wpacked-bitfield-compat  -Wpadded -Wparentheses  -Wpedantic-ms-format -Wno-pedantic-ms-format\
   -Wpointer-arith  -Wno-pointer-to-int-cast -Wredundant-decls  -Wno-return-local-addr -Wreturn-type  -Wsequence-point  -Wshadow -Wsign-compare\
   -Wsign-conversion -Wfloat-conversion -Wsizeof-pointer-memaccess -Wstack-protector -Wstack-usage=<len> -Wstrict-aliasing[=<n>]\
   -Wstrict-overflow[=<n>] -Wsuggest-attribute=[pure|const|noreturn|format] -Wmissing-format-attribute -Wswitch  -Wswitch-default\
   -Wswitch-enum -Wsync-nand -Wsystem-headers  -Wtrampolines  -Wtrigraphs  -Wtype-limits  -Wundef -Wuninitialized  -Wunknown-pragmas\
   -Wno-pragmas -Wunsuffixed-float-constants  -Wunused  -Wunused-function -Wunused-label  -Wunused-local-typedefs -Wunused-parameter\
   -Wno-unused-result -Wunused-value  -Wunused-variable -Wunused-but-set-parameter -Wunused-but-set-variable -Wuseless-cast -Wvariadic-macros\
   -Wvector-operation-performance -Wvla -Wvolatile-register-var  -Wwrite-strings -Wzero-as-null-pointer-constant';

//C and Objective-C-only 
GCC_OPTIONS['Warning Options'] += '\
   -Wbad-function-cast  -Wmissing-declarations -Wmissing-parameter-type  -Wmissing-prototypes  -Wnested-externs -Wold-style-declaration\
   -Wold-style-definition -Wstrict-prototypes  -Wtraditional  -Wtraditional-conversion -Wdeclaration-after-statement -Wpointer-sign';

//C++ and Objective-C++ only
GCC_OPTIONS['Warning Options'] += '\
   -Wc++0x-compat -Wno-c++0x-compat';

GCC_OPTIONS['Debugging Options'] = '\
   -d<letters>  -dumpspecs  -dumpmachine  -dumpversion -fsanitize=<style> -fdbg-cnt-list -fdbg-cnt=<counter-value-list> -fdisable-ipa-<pass_name>\
   -fdisable-rtl-<pass-name>[=<range-list>] -fdisable-tree-<pass-name>[=<range-list>] -fdump-noaddr\
   -fdump-unnumbered -fdump-unnumbered-links -fdump-translation-unit[-<n>] -fdump-class-hierarchy[-<n>] -fdump-ipa-all -fdump-ipa-cgraph\
   -fdump-ipa-inline -fdump-passes -fdump-statistics -fdump-tree-all -fdump-tree-original[-<n>] -fdump-tree-optimized[-<n>] -fdump-tree-cfg\
   -fdump-tree-alias -fdump-tree-ch -fdump-tree-ssa[-<n>] -fdump-tree-pre[-<n>] -fdump-tree-ccp[-<n>] -fdump-tree-dce[-<n>] -fdump-tree-gimple[-raw]\
   -fdump-tree-dom[-<n>] -fdump-tree-dse[-<n>] -fdump-tree-phiprop[-<n>] -fdump-tree-phiopt[-<n>] -fdump-tree-forwprop[-<n>] -fdump-tree-copyrename[-<n>]\
   -fdump-tree-nrv -fdump-tree-vect -fdump-tree-sink -fdump-tree-sra[-<n>] -fdump-tree-fre[-<n>] -fdump-tree-vtable-verify\
   -fdump-tree-vrp[-<n>] -fdump-tree-storeccp[-<n>] -fdump-final-insns=<file> -fcompare-debug[=<opts>]  -fcompare-debug-second -feliminate-dwarf2-dups\
   -fno-eliminate-unused-debug-types -feliminate-unused-debug-symbols -femit-class-debug-always -fenable-<kind>-<pass>[=<range-list>]\
   -fdebug-types-section -fmem-report-wpa -fmem-report -fpre-ipa-mem-report -fpost-ipa-mem-report -fprofile-arcs -fopt-info\
   -fopt-info-<options>[=<file>] -frandom-seed=<string> -fsched-verbose=<n> -fsel-sched-verbose -fsel-sched-dump-cfg -fsel-sched-pipelining-verbose\
   -fstack-usage  -ftest-coverage  -ftime-report -fvar-tracking -fvar-tracking-assignments  -fvar-tracking-assignments-toggle -g  -glevel\
   -gtoggle  -gcoff  -gdwarf-<version> -ggdb  -grecord-gcc-switches  -gno-record-gcc-switches -gstabs  -gstabs+  -gstrict-dwarf  -gno-strict-dwarf\
   -gvms  -gxcoff  -gxcoff+ -fno-merge-debug-strings -fno-dwarf2-cfi-asm -fdebug-prefix-map=<old>=<new> -femit-struct-debug-baseonly\
   -femit-struct-debug-reduced -femit-struct-debug-detailed[=<spec-list>] -p  -pg  -print-file-name=<library>  -print-libgcc-file-name\
   -print-multi-directory  -print-multi-lib  -print-multi-os-directory -print-prog-name=<program>  -print-search-dirs  -Q -print-sysroot\
   -print-sysroot-headers-suffix -save-temps[=[cwd|obj]] -time[=<file>]';


GCC_OPTIONS['Debugging Options'] += '\
   -gsplit-dwarf';


GCC_OPTIONS['Optimization Options'] = '\
   -faggressive-loop-optimizations -falign-functions[-<n>] -falign-jumps[-<n>] -falign-labels[-<n>] -falign-loops[-<n>] -fassociative-math\
   -fauto-inc-dec -fbranch-probabilities -fbranch-target-load-optimize -fbranch-target-load-optimize2 -fbtr-bb-exclusive -fcaller-saves\
   -fcheck-data-deps -fcombine-stack-adjustments -fconserve-stack -fcompare-elim -fcprop-registers -fcrossjumping -fcse-follow-jumps\
   -fcse-skip-blocks -fcx-fortran-rules -fcx-limited-range -fdata-sections -fdce -fdelayed-branch -fdelete-null-pointer-checks -fdevirtualize\
   -fdevirtualize-speculatively -fdse -fearly-inlining -fipa-sra -fexpensive-optimizations -ffat-lto-objects -ffast-math -ffinite-math-only\
   -ffloat-store -fexcess-precision=<style> -fforward-propagate -ffp-contract=<style> -ffunction-sections -fgcse -fgcse-after-reload -fgcse-las\
   -fgcse-lm -fgraphite-identity -fgcse-sm -fhoist-adjacent-loads -fif-conversion -fif-conversion2 -findirect-inlining -finline-functions\
   -finline-functions-called-once -finline-limit=<n> -finline-small-functions -fipa-cp -fipa-cp-clone -fipa-pta -fipa-profile -fipa-pure-const\
   -fipa-reference -fira-algorithm=<algorithm> -fira-region=<region> -fira-hoist-pressure -fira-loop-pressure -fno-ira-share-save-slots\
   -fno-ira-share-spill-slots -fira-verbose=<n> -fisolate-erroneous-paths-dereference -fisolate-erroneous-paths-attribute -fivopts\
   -fkeep-inline-functions -fkeep-static-consts -flive-range-shrinkage -floop-block -floop-interchange -floop-strip-mine -floop-nest-optimize\
   -floop-parallelize-all -flto -flto-compression-level -flto-partition=<alg> -flto-report -flto-report-wpa -fmerge-all-constants\
   -fmerge-constants -fmodulo-sched -fmodulo-sched-allow-regmoves -fmove-loop-invariants -fno-branch-count-reg -fno-defer-pop -fno-function-cse\
   -fno-guess-branch-probability -fno-inline -fno-math-errno -fno-peephole -fno-peephole2 -fno-sched-interblock -fno-sched-spec\
   -fno-signed-zeros -fno-toplevel-reorder -fno-trapping-math -fno-zero-initialized-in-bss -fomit-frame-pointer -foptimize-sibling-calls\
   -fpartial-inlining -fpeel-loops -fpredictive-commoning -fprefetch-loop-arrays -fprofile-report -fprofile-correction -fprofile-dir=<path>\
   -fprofile-generate[=<path>] -fprofile-use[=<path>] -fprofile-values -fprofile-reorder-functions -freciprocal-math\
   -free -frename-registers -freorder-blocks -freorder-blocks-and-partition -freorder-functions -frerun-cse-after-loop\
   -freschedule-modulo-scheduled-loops -frounding-math -fsched2-use-superblocks -fsched-pressure -fsched-spec-load -fsched-spec-load-dangerous\
   -fsched-stalled-insns-dep[-<n>] -fsched-stalled-insns[-<n>] -fsched-group-heuristic -fsched-critical-path-heuristic -fsched-spec-insn-heuristic\
   -fsched-rank-heuristic -fsched-last-insn-heuristic -fsched-dep-count-heuristic -fschedule-insns -fschedule-insns2 -fsection-anchors\
   -fselective-scheduling -fselective-scheduling2 -fsel-sched-pipelining -fsel-sched-pipelining-outer-loops -fshrink-wrap -fsignaling-nans\
   -fsingle-precision-constant -fsplit-ivs-in-unroller -fsplit-wide-types -fstack-protector -fstack-protector-all -fstack-protector-strong\
   -fstrict-aliasing -fstrict-overflow -fthread-jumps -ftracer -ftree-bit-ccp -ftree-builtin-call-dce -ftree-ccp -ftree-ch\
   -ftree-coalesce-inline-vars -ftree-coalesce-vars -ftree-copy-prop -ftree-copyrename -ftree-dce -ftree-dominator-opts -ftree-dse\
   -ftree-forwprop -ftree-fre -ftree-loop-if-convert -ftree-loop-if-convert-stores -ftree-loop-im -ftree-phiprop -ftree-loop-distribution\
   -ftree-loop-distribute-patterns -ftree-loop-ivcanon -ftree-loop-linear -ftree-loop-optimize -ftree-loop-vectorize -ftree-parallelize-loops=<n>\
   -ftree-pre -ftree-partial-pre -ftree-pta -ftree-reassoc -ftree-sink -ftree-slsr -ftree-sra -ftree-switch-conversion -ftree-tail-merge\
   -ftree-ter -ftree-vectorize -ftree-vrp -funit-at-a-time -funroll-all-loops -funroll-loops -funsafe-loop-optimizations\
   -funsafe-math-optimizations -funswitch-loops -fvariable-expansion-in-unroller -fvect-cost-model -fvpt -fweb -fwhole-program -fwpa\
   -fuse-ld=<linker> -fuse-linker-plugin --param <name>=<value> -O  -O0  -O1  -O2  -O3  -Os -Ofast -Og';

GCC_OPTIONS['Optimization Options'] += '\
   -fno-strict-aliasing -fno-omit-frame-pointer';

GCC_OPTIONS['Preprocessor Options'] = '\
   -A<question>=<answer> -A-<question>[=<answer>] -C  -dD  -dI  -dM  -dN -D<macro>[=<defn>]  -H -idirafter <dir> -include <file>  -imacros <file> -iprefix\
   <file>  -iwithprefix <dir> -iwithprefixbefore <dir>  -isystem <dir> -imultilib <dir> -isysroot <dir> -M  -MM  -MF <file>  -MG  -MP  -MQ <target>  -MT <target> -nostdinc -P\
   -fdebug-cpp -ftrack-macro-expansion -fworking-directory -remap -trigraphs  -undef  -U<macro> -Wp,<option> -Xpreprocessor <option>\
   -no-integrated-cpp';

GCC_OPTIONS['Preprocessor Options'] += '\
   -MD -MMD';

GCC_OPTIONS['Assembler Option'] = '\
   -Wa,<option>  -Xassembler <option>';

GCC_OPTIONS['Linker Options'] = '\
   <object-file-name>  -l<library> -nostartfiles  -nodefaultlibs  -nostdlib -pie -rdynamic -s  -static -static-libgcc -static-libstdc++\
   -static-libasan -static-libtsan -static-liblsan -static-libubsan -shared -shared-libgcc  -symbolic -T <script>  -Wl,<option>  -Xlinker <option> -u\
   <symbol>';

GCC_OPTIONS['Directory Options'] = '\
   -B<prefix> -I<dir> -iplugindir=<dir> -iquote<dir> -L<dir> -specs=<file> -I- --sysroot=<dir> --no-sysroot-suffix';


//['ARM Options']
//-march=<name> -mabi=<name>  -mnop-fun-dllimport
GCC_OPTIONS['Machine Dependent Options'] = '\
   -mapcs-frame  -mno-apcs-frame -mapcs-stack-check  -mno-apcs-stack-check -mapcs-float  -mno-apcs-float -mapcs-reentrant\
   -mno-apcs-reentrant -msched-prolog  -mno-sched-prolog -mlittle-endian  -mbig-endian  -mwords-little-endian -mfloat-abi=<name>\
   -mfp16-format=<name> -mthumb-interwork  -mno-thumb-interwork -mcpu=<name>   -mfpu=<name> -mstructure-size-boundary=<n>\
   -mabort-on-noreturn -mlong-calls  -mno-long-calls -msingle-pic-base  -mno-single-pic-base -mpic-register=<reg> \
   -mpoke-function-name -mthumb  -marm -mtpcs-frame  -mtpcs-leaf-frame -mcaller-super-interworking  -mcallee-super-interworking -mtp=<name>\
   -mtls-dialect=<dialect> -mword-relocations -mfix-cortex-m3-ldrd -munaligned-access -mneon-for-64bits -mslow-flash-data -mrestrict-it';

//['Darwin Options']
GCC_OPTIONS['Machine Dependent Options'] += '\
   -all_load  -allowable_client  -arch <cpu-type>  -arch_errors_fatal -arch_only  -bind_at_load  -bundle  -bundle_loader -client_name\
   -compatibility_version  -current_version -dead_strip -dependency-file  -dylib_file  -dylinker_install_name -dynamic  -dynamiclib\
   -exported_symbols_list -filelist  -flat_namespace  -force_cpusubtype_ALL -force_flat_namespace  -headerpad_max_install_names -iframework\
   -image_base  -init  -install_name  -keep_private_externs -multi_module  -multiply_defined  -multiply_defined_unused -noall_load\
   -no_dead_strip_inits_and_terms -nofixprebinding -nomultidefs  -noprebind  -noseglinkedit -pagezero_size  -prebind\
   -prebind_all_twolevel_modules -private_bundle  -read_only_relocs  -sectalign -sectobjectsymbols  -whyload  -seg1addr -sectcreate\
   -sectorder -segaddr -segs_read_only_addr -segs_read_write_addr -seg_addr_table  -seg_addr_table_filename  -seglinkedit\
   -segprot -single_module  -sub_library  -sub_umbrella -twolevel_namespace  -umbrella\
   -undefined -unexported_symbols_list  -weak_reference_mismatches -whatsloaded -F -gused -gfull -mmacosx-version-min=<version> -mkernel\
   -mone-byte-bool';

//['GNU/Linux Options']
GCC_OPTIONS['Machine Dependent Options'] += '\
   -mglibc -muclibc -mbionic -mandroid -tno-android-cc -tno-android-ld';

//['i386 and x86-64 Options']
//
GCC_OPTIONS['Machine Dependent Options'] += '\
   -mtune=<cpu-type>  -march=<cpu-type> -mtune-ctrl=<feature-list> -mdump-tune-features -mno-default -mfpmath=<unit>\
   -masm=<dialect>  -mno-fancy-math-387 -mno-fp-ret-in-387  -msoft-float -mno-wide-multiply  -mrtd  -malign-double -mpreferred-stack-boundary=<num>\
   -mincoming-stack-boundary=<num> -mcld -mcx16 -msahf -mmovbe -mcrc32 -mrecip[=<opt>] -mvzeroupper -mprefer-avx128 -mmmx  -msse  -msse2\
   -msse3 -mssse3 -msse4.1 -msse4.2 -msse4 -mavx -mavx2 -mavx512f -mavx512pf -mavx512er -mavx512cd -msha -maes -mpclmul -mfsgsbase -mrdrnd\
   -mf16c -mfma -mprefetchwt1 -msse4a -m3dnow -mpopcnt -mabm -mbmi -mtbm -mfma4 -mxop -mlzcnt -mbmi2 -mfxsr -mxsave -mxsaveopt -mrtm -mlwp\
   -mthreads -mno-align-stringops  -minline-all-stringops -minline-stringops-dynamically -mstringop-strategy=<alg> -mmemcpy-strategy=<strategy>\
   -mmemset-strategy=<strategy> -mpush-args  -maccumulate-outgoing-args  -m128bit-long-double -m96bit-long-double -mlong-double-64\
   -mlong-double-80 -mlong-double-128 -mregparm=<num>  -msseregparm -mveclibabi=<type> -mvect8-ret-in-mem -mpc32 -mpc64 -mpc80 -mstackrealign\
   -momit-leaf-frame-pointer  -mno-red-zone -mno-tls-direct-seg-refs -mcmodel=<code-model> -mabi=<name> -maddress-mode=<mode> -m32 -m64 -mx32 -m16\
   -mlarge-data-threshold=<num> -msse2avx -mfentry -m8bit-idiv -mavx256-split-unaligned-load -mavx256-split-unaligned-store\
   -mstack-protector-guard=<guard>';

GCC_OPTIONS['Machine Dependent Options'] += '\
   -mno-ssse3';


//['i386 and x86-64 Windows Options']
GCC_OPTIONS['Machine Dependent Options'] += '\
   -mconsole -mcygwin -mno-cygwin -mdll -mnop-fun-dllimport -mthread -municode -mwin32 -mwindows\
   -fno-set-stack-executable';


GCC_OPTIONS['Code Generation Options'] = '\
   -fcall-saved-<reg>  -fcall-used-<reg> -ffixed-<reg>  -fexceptions -fnon-call-exceptions  -fdelete-dead-exceptions  -funwind-tables\
   -fasynchronous-unwind-tables -fno-gnu-unique -finhibit-size-directive  -finstrument-functions\
   -finstrument-functions-exclude-function-list=<sym>,<sym>,...  -finstrument-functions-exclude-file-list=<file>,<file>,...  -fno-common  -fno-ident\
   -fpcc-struct-return  -fpic  -fPIC -fpie -fPIE -fno-jump-tables -frecord-gcc-switches -freg-struct-return  -fshort-enums -fshort-double\
   -fshort-wchar -fverbose-asm  -fpack-struct[=<n>]  -fstack-check -fstack-limit-register=<reg>  -fstack-limit-symbol=<sym> -fno-stack-limit\
   -fsplit-stack -fleading-underscore  -ftls-model=<model> -fstack-reuse=<reuse_level> -ftrapv  -fwrapv  -fbounds-check -fvisibility\
   -fstrict-volatile-bitfields -fsync-libcalls';

GCC_OPTIONS['Code Generation Options'] +='\
   -fno-exceptions';

module.exports = GCC_OPTIONS;